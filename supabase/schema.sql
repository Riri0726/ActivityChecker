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
  status              text not null check (status in ('pending', 'reviewed', 'resolved', 'rejected')) default 'pending',
  instructor_remarks  text,                 -- admin response
  created_at          timestamptz not null default now()
);

-- Makeup Requests (student requests to submit a missing activity)
create table if not exists makeup_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  activity_id   uuid not null references activities(id) on delete cascade,
  student_notes text,
  status        text not null check (status in ('pending', 'approved', 'denied')) default 'pending',
  created_at    timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table sections         enable row level security;
alter table students         enable row level security;
alter table activities       enable row level security;
alter table scores           enable row level security;
alter table appeals          enable row level security;
alter table makeup_requests  enable row level security;

-- ============================================================
-- POLICIES
-- Student side: stateless lookup via anon key (no auth session)
-- Admin side: authenticated via Supabase Auth (admin email/password)
-- ============================================================

-- Helper: check if the requesting user is an authenticated admin
-- (any authenticated Supabase Auth user is treated as admin for now)
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
-- Anon (student) can insert and read their own appeals
create policy "Anon can insert appeals"
  on appeals for insert with check (true);

create policy "Anon can read appeals"
  on appeals for select using (true);

create policy "Admin can update appeals"
  on appeals for update using (is_admin());

-- MAKEUP REQUESTS
create policy "Anon can insert makeup requests"
  on makeup_requests for insert with check (true);

create policy "Anon can read makeup requests"
  on makeup_requests for select using (true);

create policy "Admin can update makeup requests"
  on makeup_requests for update using (is_admin());

-- ============================================================
-- INDEXES (for common query patterns)
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
