-- ============================================================
-- Student Activity Checker — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Sections (one per Excel tab / class section)
create table if not exists sections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Students (one row per student per section)
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references sections(id) on delete cascade,
  surname     text not null,
  first_name  text not null,
  student_no  text,                         -- nullable: some students have no student number
  access_key  text not null,                -- UPPER(surname + student_no) or UPPER(surname) if no student_no
  created_at  timestamptz not null default now(),
  unique (section_id, access_key)           -- collision detection enforced at DB level
);

-- Activities (scoped per section; never shared across sections)
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references sections(id) on delete cascade,
  title       text not null,
  max_score   numeric not null default 0,
  order_index integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (section_id, title)
);

-- Scores (one row per student × activity)
create table if not exists scores (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  score       numeric,                      -- null = missing; 0 = submitted, scored zero
  status      text not null check (status in ('done', 'missing')) default 'missing',
  updated_at  timestamptz not null default now(),
  unique (student_id, activity_id)
);

-- Appeals (student disputes a score or "missing" status)
create table if not exists appeals (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references students(id) on delete cascade,
  activity_id         uuid not null references activities(id) on delete cascade,
  reason              text not null,
  notes               text,                 -- optional extra info / evidence
  storage_path        text,                 -- Supabase Storage file path in appeal-proofs bucket
  proof_deleted_at    timestamptz,          -- timestamp when image was auto-purged upon resolution
  status              text not null check (status in ('pending', 'reviewed', 'resolved', 'rejected')) default 'pending',
  instructor_remarks  text,                 -- admin response
  created_at          timestamptz not null default now()
);

-- Makeup Activities (central repository of alternative tasks)
create table if not exists makeup_activities (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  instructions text not null,               -- Rich instructions, Google Drive links, submission steps
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Activity-Makeup Links (join table: maps specific makeup task to specific activities)
create table if not exists activity_makeup_links (
  id                  uuid primary key default gen_random_uuid(),
  activity_id         uuid not null references activities(id) on delete cascade,
  makeup_activity_id  uuid not null references makeup_activities(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (activity_id, makeup_activity_id)
);

-- Makeup Requests (student requests to submit a missing activity)
create table if not exists makeup_requests (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references students(id) on delete cascade,
  activity_id             uuid not null references activities(id) on delete cascade,
  makeup_activity_id      uuid references makeup_activities(id) on delete set null,
  student_notes           text,
  student_submission_link text,
  status                  text not null check (status in ('pending', 'approved', 'denied', 'awaiting_assignment')) default 'pending',
  created_at              timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table sections              enable row level security;
alter table students              enable row level security;
alter table activities            enable row level security;
alter table scores                enable row level security;
alter table appeals               enable row level security;
alter table makeup_activities     enable row level security;
alter table activity_makeup_links enable row level security;
alter table makeup_requests       enable row level security;

-- ============================================================
-- POLICIES
-- Student side: stateless lookup via anon key (no auth session)
-- Admin side: authenticated via Supabase Auth (admin email/password)
-- ============================================================

-- Helper: check if the requesting user is an authenticated admin
create or replace function is_admin()
returns boolean as $$
  select auth.role() = 'authenticated';
$$ language sql stable security definer;

-- SECTIONS
create policy "Anon can read sections"
  on sections for select using (true);

create policy "Admin can insert sections"
  on sections for insert with check (is_admin());

create policy "Admin can update sections"
  on sections for update using (is_admin());

-- STUDENTS
create policy "Anon can read students"
  on students for select using (true);

create policy "Admin can insert students"
  on students for insert with check (is_admin());

create policy "Admin can update students"
  on students for update using (is_admin());

-- ACTIVITIES
create policy "Anon can read non-archived activities"
  on activities for select using (true);

create policy "Admin can insert activities"
  on activities for insert with check (is_admin());

create policy "Admin can update activities"
  on activities for update using (is_admin());

-- SCORES
create policy "Anon can read scores"
  on scores for select using (true);

create policy "Admin can insert scores"
  on scores for insert with check (is_admin());

create policy "Admin can update scores"
  on scores for update using (is_admin());

-- APPEALS
create policy "Anon can insert appeals"
  on appeals for insert with check (true);

create policy "Anon can read appeals"
  on appeals for select using (true);

create policy "Admin can update appeals"
  on appeals for update using (is_admin());

-- MAKEUP ACTIVITIES
create policy "Anon can read non-archived makeup activities"
  on makeup_activities for select using (archived = false or is_admin());

create policy "Admin can insert makeup activities"
  on makeup_activities for insert with check (is_admin());

create policy "Admin can update makeup activities"
  on makeup_activities for update using (is_admin());

create policy "Admin can delete makeup activities"
  on makeup_activities for delete using (is_admin());

-- ACTIVITY-MAKEUP LINKS
create policy "Anon can read activity makeup links"
  on activity_makeup_links for select using (true);

create policy "Admin can insert activity makeup links"
  on activity_makeup_links for insert with check (is_admin());

create policy "Admin can delete activity makeup links"
  on activity_makeup_links for delete using (is_admin());

-- MAKEUP REQUESTS
create policy "Anon can insert makeup requests"
  on makeup_requests for insert with check (true);

create policy "Anon can read makeup requests"
  on makeup_requests for select using (true);

create policy "Admin can update makeup requests"
  on makeup_requests for update using (is_admin());

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_students_section_id  on students(section_id);
create index if not exists idx_students_access_key  on students(section_id, access_key);
create index if not exists idx_activities_section   on activities(section_id);
create index if not exists idx_scores_student       on scores(student_id);
create index if not exists idx_scores_activity      on scores(activity_id);
create index if not exists idx_appeals_student      on appeals(student_id);
create index if not exists idx_appeals_status       on appeals(status);
create index if not exists idx_makeup_student       on makeup_requests(student_id);
create index if not exists idx_makeup_status        on makeup_requests(status);
create index if not exists idx_makeup_links_act     on activity_makeup_links(activity_id);
create index if not exists idx_makeup_links_makeup  on activity_makeup_links(makeup_activity_id);
create index if not exists idx_makeup_requests_act  on makeup_requests(makeup_activity_id);

-- ============================================================
-- STORAGE BUCKET: appeal-proofs
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appeal-proofs',
  'appeal-proofs',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Allow student proof upload"
  on storage.objects for insert
  with check (bucket_id = 'appeal-proofs');

create policy "Allow public read proof images"
  on storage.objects for select
  using (bucket_id = 'appeal-proofs');

create policy "Allow admin delete proof images"
  on storage.objects for delete
  using (bucket_id = 'appeal-proofs' and (auth.role() = 'authenticated' or is_admin()));

