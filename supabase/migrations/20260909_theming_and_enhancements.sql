-- ============================================================
-- Migration: Admin Theming + Permanent Workbook Deletion Policies
-- Run after 20260907_multi_admin.sql
-- ============================================================

-- 1. Add theme column to admins
alter table admins
  add column if not exists theme text not null default 'blue'
  check (theme in ('blue', 'black', 'purple', 'green'));

-- 2. Delete policies for permanent workbook deletion (cascading)
-- Students delete policy
drop policy if exists "Admins can delete students" on students;
create policy "Admins can delete students"
  on students for delete
  using (is_super_admin() or section_id in (
    select id from sections where admin_id = auth.uid()
  ));

-- Scores delete policy
drop policy if exists "Admins can delete scores" on scores;
create policy "Admins can delete scores"
  on scores for delete
  using (auth.role() = 'authenticated');

-- Activities delete policy (may already exist from multi_admin migration)
drop policy if exists "Admins can delete activities" on activities;
create policy "Admins can delete activities"
  on activities for delete
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);

-- Sections delete policy (may already exist from multi_admin migration)
drop policy if exists "Admins can delete sections" on sections;
create policy "Admins can delete sections"
  on sections for delete
  using (is_super_admin() or admin_id = auth.uid() or admin_id is null);
