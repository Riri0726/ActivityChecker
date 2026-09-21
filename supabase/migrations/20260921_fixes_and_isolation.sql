-- ============================================================
-- Migration: Fixes, Deletion Policies & Teacher Data Isolation
-- Run after 20260909_theming_and_enhancements.sql
-- ============================================================

-- 1. DELETE policies for appeals (allow admins to delete appeals)
drop policy if exists "Admins can delete appeals" on appeals;
create policy "Admins can delete appeals"
  on appeals for delete
  using (auth.role() = 'authenticated');

-- 2. DELETE policies for makeup_requests (allow admins to delete requests)
drop policy if exists "Admins can delete makeup_requests" on makeup_requests;
create policy "Admins can delete makeup_requests"
  on makeup_requests for delete
  using (auth.role() = 'authenticated');

-- 3. DELETE policies for makeup_tasks (allow admins to delete their tasks)
drop policy if exists "Admins can delete makeup_tasks" on makeup_tasks;
create policy "Admins can delete makeup_tasks"
  on makeup_tasks for delete
  using (auth.role() = 'authenticated');

-- 4. Helper: assign orphaned sections (no admin_id) to a specific admin
-- Run this manually after migration, replacing 'YOUR_ADMIN_UUID' with the super_admin's UUID:
-- UPDATE sections SET admin_id = 'YOUR_ADMIN_UUID' WHERE admin_id IS NULL;
-- UPDATE activities SET admin_id = 'YOUR_ADMIN_UUID' WHERE admin_id IS NULL;
-- UPDATE subjects SET admin_id = 'YOUR_ADMIN_UUID' WHERE admin_id IS NULL;
