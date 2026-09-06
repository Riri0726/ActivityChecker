-- ============================================================
-- Migration: 20260907_makeup_and_storage.sql
-- Makeup Activity Bank & Appeal Proof Storage with Auto-Purge
-- ============================================================

-- 1. MAKEUP ACTIVITIES TABLE (Central repository of alternative assignments)
create table if not exists makeup_activities (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  instructions text not null,                       -- Rich instructions, Google Drive links, submission steps
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. ACTIVITY-MAKEUP LINKS (Many-to-Many join table)
-- Links a makeup task specifically to the regular activities it can replace
create table if not exists activity_makeup_links (
  id                  uuid primary key default gen_random_uuid(),
  activity_id         uuid not null references activities(id) on delete cascade,
  makeup_activity_id  uuid not null references makeup_activities(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (activity_id, makeup_activity_id)
);

-- 3. ALTER MAKEUP REQUESTS TABLE
alter table makeup_requests
  add column if not exists makeup_activity_id uuid references makeup_activities(id) on delete set null,
  add column if not exists student_submission_link text;

-- Update status check constraint on makeup_requests to include 'awaiting_assignment'
alter table makeup_requests drop constraint if exists makeup_requests_status_check;
alter table makeup_requests add constraint makeup_requests_status_check
  check (status in ('pending', 'approved', 'denied', 'awaiting_assignment'));

-- 4. ALTER APPEALS TABLE (Storage path & deletion audit)
alter table appeals
  add column if not exists storage_path text,
  add column if not exists proof_deleted_at timestamptz;

-- 5. ROW LEVEL SECURITY ON NEW TABLES
alter table makeup_activities     enable row level security;
alter table activity_makeup_links enable row level security;

-- Anon can read non-archived makeup activities
create policy "Anon can read non-archived makeup activities"
  on makeup_activities for select
  using (archived = false or is_admin());

-- Admin full control on makeup_activities
create policy "Admin can insert makeup activities"
  on makeup_activities for insert
  with check (is_admin());

create policy "Admin can update makeup activities"
  on makeup_activities for update
  using (is_admin());

create policy "Admin can delete makeup activities"
  on makeup_activities for delete
  using (is_admin());

-- Anon can read activity_makeup_links
create policy "Anon can read activity makeup links"
  on activity_makeup_links for select
  using (true);

-- Admin can manage activity_makeup_links
create policy "Admin can insert activity makeup links"
  on activity_makeup_links for insert
  with check (is_admin());

create policy "Admin can delete activity makeup links"
  on activity_makeup_links for delete
  using (is_admin());

-- 6. INDEXES
create index if not exists idx_makeup_links_activity on activity_makeup_links(activity_id);
create index if not exists idx_makeup_links_makeup   on activity_makeup_links(makeup_activity_id);
create index if not exists idx_makeup_requests_act   on makeup_requests(makeup_activity_id);

-- 7. SUPABASE STORAGE BUCKET: appeal-proofs
-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appeal-proofs',
  'appeal-proofs',
  true, -- public URLs for easy display; auto-purge cleans objects on resolution
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage Policies:
-- Anyone (students) can upload proof images to appeal-proofs bucket
create policy "Allow student proof upload"
  on storage.objects for insert
  with check (bucket_id = 'appeal-proofs');

-- Anyone can view proof images (or authenticated admins)
create policy "Allow public read proof images"
  on storage.objects for select
  using (bucket_id = 'appeal-proofs');

-- Only authenticated admins can delete proof images (during appeal resolution)
create policy "Allow admin delete proof images"
  on storage.objects for delete
  using (bucket_id = 'appeal-proofs' and (auth.role() = 'authenticated' or is_admin()));
