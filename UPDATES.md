# System Updates & Release Specifications

## [v0.5.0] - 2026-09-07: Appeals Image Lifecycle & Dynamic Make-Up Activity Repository

### 1. Overview
This release finalizes two key workflows:
1. **Dynamic Make-Up Activity Assignment**: An admin-managed central repository of alternative/make-up tasks scoped and linked to specific missing activities across sections.
2. **Appeals Proof Lifecycle & Auto-Purge Protocol**: File upload in student appeals (max 5MB, JPG/PNG/WEBP) with immediate automatic purging from Supabase Storage upon admin resolution (approved or rejected) to strictly protect free-tier limits.

---

### 2. Database Schema Additions & Migrations
Migration script: `supabase/migrations/20260907_makeup_and_storage.sql`

#### Tables
- **`makeup_activities`**:
  - `id` (UUID, Primary Key)
  - `title` (TEXT, Not Null)
  - `description` (TEXT, Nullable)
  - `instructions` (TEXT, Not Null) — rich directions, submission links (e.g. Google Drive/Form)
  - `archived` (BOOLEAN, Default False)
  - `created_at` (TIMESTAMPTZ, Default now())
  - `updated_at` (TIMESTAMPTZ, Default now())

- **`activity_makeup_links`** (Join Table):
  - `id` (UUID, Primary Key)
  - `activity_id` (UUID, FK -> `activities.id` on delete cascade)
  - `makeup_activity_id` (UUID, FK -> `makeup_activities.id` on delete cascade)
  - `unique (activity_id, makeup_activity_id)`

#### Column Alterations
- **`makeup_requests`**:
  - Added `makeup_activity_id` (UUID, FK -> `makeup_activities.id`)
  - Added `student_submission_link` (TEXT, Nullable)
  - Status enum constraint updated: `('pending', 'approved', 'denied', 'awaiting_assignment')`
- **`appeals`**:
  - Added `storage_path` (TEXT, Nullable)
  - Added `proof_deleted_at` (TIMESTAMPTZ, Nullable)

---

### 3. Supabase Storage & Auto-Purge Protocol
- **Bucket**: `appeal-proofs` (Public, file size limit: 5MB, allowed mime types: `image/jpeg`, `image/png`, `image/webp`).
- **Path structure**: `/{section_id}/{student_id}/{timestamp}_{filename}.ext`
- **Storage Policies (`storage.objects`)**:
  - Insert: Anyone (students) can upload proof images.
  - Select: Public/Anon read for thumbnail rendering.
  - Delete: Only authenticated admin can delete objects.
- **Automated Storage Cleanup Hook**:
  - Triggered in `adminService.updateAppeal(appealId, { status, instructorRemarks })`.
  - When status changes to `resolved` (approved) or `rejected`:
    1. Fetches current `storage_path`.
    2. Calls `supabase.storage.from('appeal-proofs').remove([storage_path])`.
    3. Updates the database record setting `storage_path = null` and `proof_deleted_at = now()`.
    4. Guarantees zero orphaned files accumulate in Supabase Storage.

---

### 4. Admin & Student UI Features
- **Admin Dashboard**: Added `📦 Makeup Bank` navigation tab (`MakeupManager.jsx`) for creating, editing, and linking alternative assignments to section activities.
- **Appeals Manager**: Displays proof image thumbnail with zoom/external link and shows `🗑️ Proof purged` audit badge after resolution.
- **Makeup Requests Manager**: Displays assigned makeup task title/instructions and student submission link.
- **Student Appeal Form**: Optional image upload with 5MB validation, file type check, live preview, and cancel/remove image control.
- **Student Makeup Request Form**: Selectable card picker of active linked makeup tasks with real-time instructions and submission link input (or "awaiting assignment" fallback).
