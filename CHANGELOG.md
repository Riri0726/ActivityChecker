# Changelog

All notable changes to the Student Activity Checker portal are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and Semantic Versioning.

---

## [v0.9.0] - 2026-09-21

### Added
- **In-App Spreadsheet Editor (`EditablePreview.jsx`)**: Interactive table editor right after parsing Excel files, allowing teachers to edit student details & scores, add/delete rows, and view live diff highlights before importing.
- **Direct Student Management in Gradebook (`Gradebook.jsx`)**: "➕ Add Student" modal and row-level 🗑️ delete buttons with confirmation modals and cascade deletion.
- **Appeals & Make-up Request Deletion**: Permanent delete options for appeals and make-up requests in `AppealsManager.jsx` and `RequestsManager.jsx`.
- **Super-Admin "View As Teacher" Mode (`AdminDashboard.jsx`)**: Dropdown switch allowing super-admins to inspect any instructor's course data without modifying account roles.
- **Automated Test Suite (`test-suite.js` / `npm test`)**: End-to-end unit and integration test suite covering deduplication, score handling, diff calculation, and Excel parsing.

### Fixed
- **Student ID Updates & Deduplication Bug (`adminService.js`)**: Matching existing students by full name prevents duplicate entries when a student's ID number changes on re-upload.
- **Score Status Differentiation (`excelParser.js` & `StudentDashboard.jsx`)**: Explicit distinction between score of `0` (`✓ Done (0 pts)`) vs empty cell (`⚠ Missing`).
- **Mobile File Upload & Touch Targets (`ExcelUploader.jsx` & `index.css`)**: Reliable button-based file picker trigger for mobile browsers (including Huawei/HarmonyOS) and minimum 44px touch targets.
- **Reject Buttons in Review Queues**: Inline validation errors and default remark text (`"Request rejected."`) for both appeals and make-up requests.
- **Multi-Teacher Isolation (`AuthContext.jsx` & RLS policies)**: Strict scoping of sections, appeals, make-up tasks, and requests by `effectiveAdminId`.

---

## [v0.8.1] - 2026-09-19

### Fixed
- **Student Login After Student Number Change** (`adminService.js`) — Changing a student's student number (e.g. `20252236` → `20252213`) now correctly regenerates the `access_key` used for login credentials. Previously, the `access_key` was only recalculated when the surname or first name changed, leaving the old key in place and preventing students from logging in with the updated number.

---

## [v0.8.0] - 2026-09-09

### Added
- **Dark Mode On/Off Toggle** — Comprehensive theme brightness toggle with state persistence:
  - **Admin Dashboard**: Sleek toggle switch in the sidebar footer alongside the theme color picker.
  - **Student Portal & Lookup**: Glassmorphic floating toggle button in the top-right corner.
  - **Student Dashboard**: Clean, responsive theme mode toggle right inside the header navigation.
  - **Admin Login**: Quick toggle on the login page for comfortable viewing before authentication.
  - **Persistence & Anti-Flicker**: Saves choice to `localStorage` (`app-color-mode`) with inline pre-mount script preventing theme flash on page load.
  - **Automatic System Fallback**: Uses OS dark mode preferences when no explicit override is chosen.

---

## [v0.7.1] - 2026-09-15

### Fixed
- **Mobile Browser File Upload Trigger** (`ExcelUploader.jsx`) — Replaced `div` with synthetic `onClick` with a native `<label htmlFor="excel-file-input">` and touch-friendly button. On iOS Safari and Android Chrome, synthetic clicks on hidden file inputs from delegated events were suppressed or double-triggered/canceled. Also added `onClick={(e) => { e.target.value = null; }}` so selecting the same file repeatedly always triggers `onChange`.
- **Mobile Browser ArrayBuffer Fallback** (`excelParser.js`) — Added `FileReader.readAsArrayBuffer` fallback for mobile browsers and in-app webviews where `File.arrayBuffer()` is unsupported or fails.
- **Sparse Row Object Crash** (`excelParser.js`) — ExcelJS produces Object rows (`{ 1: val, 2: val }`) instead of Arrays when files are edited and exported from mobile office apps (such as Google Sheets mobile). Calling `.slice(1)` crashed row parsing with `row.values.slice is not a function`. Safe extraction now accommodates both Arrays and Objects.
- **Excel Upload Silent Failure** — Upload on mobile (and occasionally desktop) would silently fail with no feedback. Added comprehensive error handling with `console.error` logging and user-facing error messages throughout the upload pipeline.
- **Formula Cell Parsing Bug** (`excelParser.js`) — ExcelJS formula cells (`{formula: '...', result: 50}`) and rich text cells (`{richText: [...]}`) were converted to `"[object Object]"` by `String()`, causing `parseFloat` to return `NaN` and marking all formula-based scores as missing. Added `extractCellValue()` helper to correctly extract values from all ExcelJS cell types.
- **CSV Files Accepted but Unsupported** — File input accepted `.csv` files, but the parser only supports `.xlsx`. CSV selection caused an unhandled crash. Now restricted to `.xlsx` only with clear rejection messages for `.csv` and `.xls` files.

### Added
- **Toast Notification System** (`ExcelUploader.jsx`) — Inline toast notifications (top-right, auto-dismiss after 5s) with color-coded types: 🔴 error, 🟢 success, 🟡 warning, 🔵 info. Toasts appear for file parsing start/success/failure, import start/success/failure, and file validation rejections.
- **Global React Error Boundary** (`App.jsx`) — Catches unhandled render errors across the entire application. Displays a friendly fallback UI with error details and "Reload Page" / "Try Again" buttons instead of a blank white screen.
- **Graceful Diff Computation** (`ExcelUploader.jsx`) — `computeWorkbookDiff` now wrapped in try/catch; Supabase query failures during diff are logged but no longer crash the upload flow.

---

## [v0.7.0] - 2026-09-09

### Added
- **Admin Theme System** — Admins can choose from 4 theme colors (Blue, Black, Purple, Green) via a sidebar picker. The chosen theme propagates to the student-facing dashboard, so students see their instructor's brand color on buttons, progress bars, and accents.
- **Permanent Workbook Deletion** (`Gradebook.jsx`) — Two-step destructive delete: shows impact summary (students/activities/scores count), then requires typing the section name to confirm. Hard-deletes the section and all cascaded data.
- **Inline Student Detail Editing** (`Gradebook.jsx`) — Click any student name or student number cell in the gradebook to edit it in-place. Saves on blur/Enter, cancels on Escape. Automatically regenerates the student's `access_key`.
- **Admin Sign-Up / Account Creation** (`TeacherManager.jsx`) — Super-admins can create new instructor accounts directly from the Instructors panel. A form collects Full Name, Email, Role, and a temporary password. Creates the Supabase Auth user and admins record, then displays the credentials for sharing.

### Schema / Migration
- `admins.theme` column (`text NOT NULL DEFAULT 'blue'`, check constraint for blue/black/purple/green)
- RLS delete policies for `students`, `scores`, `activities`, `sections` to support permanent workbook deletion

---

## [v0.5.0] - 2026-09-07

### Added
- **Makeup Activity Bank** (`MakeupManager.jsx`) — Central admin repository for managing alternative assignments with instructions and Google Drive links.
- **Activity-to-Makeup Linking** — Many-to-many relationship linking makeup tasks specifically to the missing activities they substitute for across sections.
- **Student-Side Makeup Flow** (`MakeupRequestForm.jsx`) — Dynamic selection modal presenting title, instructions, and student submission link (or "awaiting assignment" notice if not yet configured).
- **Appeal Proof Upload** (`AppealForm.jsx`) — Optional image upload (JPG, PNG, WEBP $\le$ 5MB) with client-side preview, validation, and cancel/remove controls.
- **Appeals Proof Auto-Purge Protocol** (`AppealsManager.jsx` & `adminService.js`) — Automated immediate cleanup of proof images from Supabase Storage upon approval (`resolved`) or rejection (`rejected`), recording `proof_deleted_at` for audit logs.

### Schema / Migration
- `makeup_activities` table (`id`, `title`, `description`, `instructions`, `archived`, `created_at`, `updated_at`)
- `activity_makeup_links` table (`id`, `activity_id`, `makeup_activity_id`, `created_at`, `unique(activity_id, makeup_activity_id)`)
- `makeup_requests` alterations: `makeup_activity_id`, `student_submission_link`, updated status constraint to include `awaiting_assignment`
- `appeals` alterations: `storage_path`, `proof_deleted_at`
- Supabase Storage bucket `appeal-proofs` with RLS policies

---

## [v0.4.0] - 2026-09-06

### Added
- **Gradebook Template Download** (`exportTemplate.js`) — Excel template export with sample rows and written instructions sheet.
- **Pre-Import Excel Preview & Checker** (`FilePreview.jsx`) — Immediate client-side validation of column headers (`[MaxScore]`), identity columns, credential collision detection, and first 5-row table preview.
- **Secured Student Portal Navigation** — Removed public `/admin` link from student lookup page.

---

## [v0.3.0] - 2026-09-06

### Added
- **Student Lookup** page (`StudentLookup.jsx`) — stateless form with Section, Surname, optional Student No.
- **Student Dashboard** (`StudentDashboard.jsx`) — flat activity list, score/percentage per row, total summary top+bottom, missing activity highlighting
- **Appeal Form** modal (`AppealForm.jsx`) — pre-filled student/activity info, reason + notes, submits to `appeals` table
- **Makeup Request Form** modal (`MakeupRequestForm.jsx`) — for missing activities, duplicate-prevention, status tracking
- **Admin Login** page (`AdminLogin.jsx`) — Supabase Auth email+password, separate from student flow
- **Admin Dashboard** (`AdminDashboard.jsx`) — sidebar navigation with notification badges, mobile hamburger menu
- **Excel Uploader** (`ExcelUploader.jsx`) — drag-and-drop, ExcelJS parsing, `Title [MaxScore]` header support, duplicate credential detection, archived activity detection
- **Gradebook** (`Gradebook.jsx`) — section selector, inline-editable score cells, real-time Supabase persistence
- **Appeals Manager** (`AppealsManager.jsx`) — filter tabs, collapsible cards, instructor remarks, status updates
- **Makeup Requests Manager** (`RequestsManager.jsx`) — filter tabs, approve/deny actions

### Changed
- `index.html` — updated SEO title and meta description; added Google Fonts preconnect
- `src/index.css` — full design system (CSS variables, dark/light mode via `prefers-color-scheme`, typography, buttons, forms, badges, tables, modals, animations)

### Schema / Migration
- No schema changes from v0.2.0

---

## [v0.2.0] - 2026-09-06

### Added
- **Supabase schema** (`supabase/schema.sql`) — all 6 tables with constraints, RLS policies, and performance indexes
- **Supabase client** (`src/services/supabase.js`) — env-validated client init
- **Student service** (`src/services/studentService.js`) — `lookupStudent`, `submitAppeal`, `submitMakeupRequest`, `deriveAccessKey`
- **Excel parser** (`src/services/excelParser.js`) — ExcelJS-based multi-tab parser, identity column detection, `[MaxScore]` parsing, duplicate access_key detection, soft-delete tracking
- **Admin service** (`src/services/adminService.js`) — full import orchestration, gradebook queries, appeals/requests management, pending badge counts
- **Auth context** (`src/context/AuthContext.jsx`) — Supabase Auth session management
- **App router** (`src/App.jsx`) — React Router v6 with protected admin routes

### Schema / Migration
- `sections` — id, name (UNIQUE), archived, created_at
- `students` — id, section_id, surname, first_name, student_no (NULLABLE), access_key, UNIQUE(section_id, access_key)
- `activities` — id, section_id, title, max_score, order_index, archived, created_at, UNIQUE(section_id, title)
- `scores` — id, student_id, activity_id, score (NULLABLE), status (done/missing), updated_at, UNIQUE(student_id, activity_id)
- `appeals` — id, student_id, activity_id, reason, notes, status, instructor_remarks, created_at
- `makeup_requests` — id, student_id, activity_id, student_notes, status, created_at
- RLS enabled on all tables; anon read, admin-only write for most; anon insert for appeals and requests



---

## [v0.1.0] - 2026-09-06

### Added
- Initial project scaffold with React + Vite
- Project structure: `src/pages`, `src/components`, `src/services`, `src/context`
- `README.md` with setup instructions
- `.env.example` with required Supabase environment variable keys
- `vercel.json` for SPA routing on Vercel
- `CHANGELOG.md` (this file)

### Schema / Migration
- Planned schema defined in `supabase/schema.sql`:
  - `sections` table (id, name, archived, created_at)
  - `students` table (id, section_id, surname, first_name, student_no nullable, access_key)
  - `activities` table (id, section_id, title, max_score, order_index, archived, created_at)
  - `scores` table (id, student_id, activity_id, score nullable, status, updated_at)
  - `appeals` table (id, student_id, activity_id, reason, notes, status, instructor_remarks, created_at)
  - `makeup_requests` table (id, student_id, activity_id, student_notes, status, created_at)
