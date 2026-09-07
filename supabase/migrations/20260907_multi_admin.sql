-- ============================================================
-- Migration: Multi-Admin Architecture + Subjects + Phase 2 Workflows
-- ============================================================

-- Enable pgcrypto
create extension if not exists "pgcrypto";

-- 1. ADMINS TABLE (Teachers and Super Admins)
create table if not exists admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        text not null default 'teacher' check (role in ('teacher', 'super_admin')),
  created_at  timestamptz not null default now()
);

-- 2. SUBJECTS TABLE (Courses taught by teachers)
create table if not exists subjects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,                         -- e.g. CS101, IT202
  name        text not null,                         -- e.g. Web Development
  description text,
  admin_id    uuid not null references admins(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 3. ENHANCE SECTIONS WITH SUBJECT & ADMIN
alter table sections
  add column if not exists subject_id uuid references subjects(id) on delete cascade,
  add column if not exists admin_id uuid references admins(id) on delete cascade;

-- 4. ENHANCE ACTIVITIES WITH SUBJECT, ADMIN & MAKEUP CONTROLS
alter table activities
  add column if not exists subject_id uuid references subjects(id) on delete cascade,
  add column if not exists admin_id uuid references admins(id) on delete cascade,
  add column if not exists makeup_task_id uuid,
  add column if not exists accepting_requests boolean not null default true,
  add column if not exists request_deadline timestamptz;

-- 5. MAKEUP TASKS TABLE (Reusable Task Pool scoped to Admin/Subject/Section)
create table if not exists makeup_tasks (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid references admins(id) on delete cascade,
  subject_id      uuid references subjects(id) on delete cascade,
  section_id      uuid references sections(id) on delete cascade,
  title           text not null,
  submission_mode text not null default 'gdrive_link' check (submission_mode in ('gdrive_link', 'physical_submission', 'custom_instructions')),
  instructions    text not null,
  submission_url  text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Add foreign key from activities to makeup_tasks if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'activities_makeup_task_id_fkey'
  ) then
    alter table activities
      add constraint activities_makeup_task_id_fkey
      foreign key (makeup_task_id) references makeup_tasks(id) on delete set null;
  end if;
end $$;

-- 6. ENHANCE MAKEUP REQUESTS (Two-Stage Workflow)
alter table makeup_requests
  add column if not exists student_email text,
  add column if not exists reason text,
  add column if not exists makeup_task_id uuid references makeup_tasks(id) on delete set null,
  add column if not exists submission_link text,
  add column if not exists instructor_remarks text;

-- Update status check constraint on makeup_requests
alter table makeup_requests drop constraint if exists makeup_requests_status_check;
alter table makeup_requests add constraint makeup_requests_status_check
  check (status in (
    'pending_review',
    'approved_pending_submission',
    'submitted',
    'completed',
    'rejected',
    -- Legacy statuses for backwards compatibility
    'pending',
    'approved',
    'denied',
    'awaiting_assignment'
  ));

-- 7. ENHANCE APPEALS (Storage path & Auto-purge tracking)
alter table appeals
  add column if not exists storage_path text,
  add column if not exists proof_purged_at timestamptz,
  add column if not exists proof_deleted_at timestamptz,
  add column if not exists proof_url text;

-- Ensure proof_url is nullable
alter table appeals alter column proof_url drop not null;

-- ============================================================
-- HELPER FUNCTIONS FOR SECURITY & ISOLATION
-- ============================================================

create or replace function current_admin_role()
returns text as $$
  select coalesce(
    (select role from admins where id = auth.uid()),
    'none'
  );
$$ language sql stable security definer;

create or replace function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from admins
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql stable security definer;

create or replace function is_any_admin()
returns boolean as $$
  select auth.role() = 'authenticated' and exists (
    select 1 from admins where id = auth.uid()
  );
$$ language sql stable security definer;

-- ============================================================
-- ROW LEVEL SECURITY OVERHAUL
-- ============================================================

alter table admins       enable row level security;
alter table subjects     enable row level security;
alter table sections     enable row level security;
alter table activities   enable row level security;
alter table students     enable row level security;
alter table scores       enable row level security;
alter table makeup_tasks enable row level security;
alter table makeup_requests enable row level security;
alter table appeals      enable row level security;

-- Drop existing policies to make migration idempotent
drop policy if exists "Authenticated users can read admin profiles" on admins;
drop policy if exists "Super admins can insert admins" on admins;
drop policy if exists "Super admins can update admins" on admins;
drop policy if exists "Super admins can delete admins" on admins;

drop policy if exists "Anon and admins can read subjects" on subjects;
drop policy if exists "Admins can insert subjects" on subjects;
drop policy if exists "Admins can update subjects" on subjects;
drop policy if exists "Admins can delete subjects" on subjects;

drop policy if exists "Anon and admins can read sections" on sections;
drop policy if exists "Admins can insert sections" on sections;
drop policy if exists "Admins can update sections" on sections;
drop policy if exists "Admins can delete sections" on sections;

drop policy if exists "Anon and admins can read activities" on activities;
drop policy if exists "Admins can insert activities" on activities;
drop policy if exists "Admins can update activities" on activities;
drop policy if exists "Admins can delete activities" on activities;

drop policy if exists "Anon and admins can read makeup tasks" on makeup_tasks;
drop policy if exists "Admins can insert makeup tasks" on makeup_tasks;
drop policy if exists "Admins can update makeup tasks" on makeup_tasks;
drop policy if exists "Admins can delete makeup tasks" on makeup_tasks;

drop policy if exists "Anon and admins can read makeup requests" on makeup_requests;
drop policy if exists "Anon can insert makeup requests" on makeup_requests;
drop policy if exists "Admins can update makeup requests" on makeup_requests;

drop policy if exists "Anon and admins can read appeals" on appeals;
drop policy if exists "Anon can insert appeals" on appeals;
drop policy if exists "Admins can update appeals" on appeals;

-- ADMINS POLICIES
create policy "Authenticated users can read admin profiles"
  on admins for select
  using (auth.role() = 'authenticated');

create policy "Super admins can insert admins"
  on admins for insert
  with check (is_super_admin() or not exists (select 1 from admins));

create policy "Super admins can update admins"
  on admins for update
  using (is_super_admin() or id = auth.uid());

create policy "Super admins can delete admins"
  on admins for delete
  using (is_super_admin());

-- SUBJECTS POLICIES
create policy "Anon and admins can read subjects"
  on subjects for select
  using (true);

create policy "Admins can insert subjects"
  on subjects for insert
  with check (is_super_admin() or admin_id = auth.uid());

create policy "Admins can update subjects"
  on subjects for update
  using (is_super_admin() or admin_id = auth.uid());

create policy "Admins can delete subjects"
  on subjects for delete
  using (is_super_admin() or admin_id = auth.uid());

-- SECTIONS POLICIES
create policy "Anon and admins can read sections"
  on sections for select
  using (true);

create policy "Admins can insert sections"
  on sections for insert
  with check (is_super_admin() or admin_id = auth.uid() or admin_id is null);

create policy "Admins can update sections"
  on sections for update
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

create policy "Admins can delete sections"
  on sections for delete
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

-- ACTIVITIES POLICIES
create policy "Anon and admins can read activities"
  on activities for select
  using (true);

create policy "Admins can insert activities"
  on activities for insert
  with check (is_super_admin() or admin_id = auth.uid() or admin_id is null);

create policy "Admins can update activities"
  on activities for update
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

create policy "Admins can delete activities"
  on activities for delete
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

-- MAKEUP TASKS POLICIES
create policy "Anon and admins can read makeup tasks"
  on makeup_tasks for select
  using (true);

create policy "Admins can insert makeup tasks"
  on makeup_tasks for insert
  with check (is_super_admin() or admin_id = auth.uid() or admin_id is null);

create policy "Admins can update makeup tasks"
  on makeup_tasks for update
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

create policy "Admins can delete makeup tasks"
  on makeup_tasks for delete
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

-- MAKEUP REQUESTS POLICIES
create policy "Anon and admins can read makeup requests"
  on makeup_requests for select
  using (true);

create policy "Anon can insert makeup requests"
  on makeup_requests for insert
  with check (true);

create policy "Admins can update makeup requests"
  on makeup_requests for update
  using (auth.role() = 'authenticated');

-- APPEALS POLICIES
create policy "Anon and admins can read appeals"
  on appeals for select
  using (true);

create policy "Anon can insert appeals"
  on appeals for insert
  with check (true);

create policy "Admins can update appeals"
  on appeals for update
  using (auth.role() = 'authenticated');

-- STORAGE BUCKET: appeal-proofs
insert into storage.buckets (id, name, public)
values ('appeal-proofs', 'appeal-proofs', false)
on conflict (id) do update set public = false;

-- Storage RLS:
drop policy if exists "Anon can upload appeal proofs" on storage.objects;
drop policy if exists "Admins can read appeal proofs" on storage.objects;
drop policy if exists "Admins can delete appeal proofs" on storage.objects;

create policy "Anon can upload appeal proofs"
  on storage.objects for insert
  with check (bucket_id = 'appeal-proofs');

create policy "Admins can read appeal proofs"
  on storage.objects for select
  using (bucket_id = 'appeal-proofs' and auth.role() = 'authenticated');

create policy "Admins can delete appeal proofs"
  on storage.objects for delete
  using (bucket_id = 'appeal-proofs' and auth.role() = 'authenticated');
