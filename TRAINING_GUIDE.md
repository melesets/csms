# AGH-CSMS — End-to-End Training Guide
## Arsho General Hospital - Clinical Staff Management System

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Login & Authentication](#3-login--authentication)
4. [Sidebar Navigation](#4-sidebar-navigation)
5. [Clinical Module](#5-clinical-module)
   - 5.1 Dashboard
   - 5.2 ISBAR Report
   - 5.3 Department Activity (Staff Check-In/Out)
   - 5.4 Resources
   - 5.5 All Records
   - 5.6 Analytics
   - 5.7 Staff Schedule
6. [Admin Module](#6-admin-module)
   - 6.1 Form Builder
   - 6.2 Custom Tabs
   - 6.3 Dashboard Mapping
   - 6.4 Integrations
   - 6.5 Check-In Logs
   - 6.6 Attendance Reports
   - 6.7 User Management (PIN Reset)
   - 6.8 Settings
7. [Staff Check-In/Out Workflow](#7-staff-check-inout-workflow)
8. [PIN Management (Forgot Password)](#8-pin-management-forgot-password)
9. [Ethiopian Calendar Integration](#9-ethiopian-calendar-integration)
10. [Export Features](#10-export-features)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. System Overview

AGH-CSMS is a hospital clinical staff management system built for Arsho General Hospital. It handles:

- **Staff check-in/out** with PIN-based authentication
- **ISBAR clinical reporting** (Identify, Situation, Background, Assessment, Recommendation)
- **Staff scheduling** with Ethiopian calendar
- **Patient records** and analytics
- **Resource management** per department
- **Custom dashboards** with configurable tabs

### Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Charts**: Recharts
- **Calendar**: Custom Ethiopian (Ge'ez) calendar system
- **Export**: html2canvas (PNG), HTML-to-Excel (XLS)

---

## 2. User Roles & Permissions

| Role | Access Level | Can Do |
|------|-------------|--------|
| **superadmin** | Full access | Everything. Sees all departments. Can impersonate users. |
| **admin** | Full access | Everything. Sees all departments. Can manage users/settings. |
| **user** | Department head | Manage their own department's staff. View dashboard, create ISBAR reports, view resources/database/analytics, edit schedules. **Cannot** access form-builder or user-management. |
| **staff** | Minimal | View dashboard, view schedule, edit forms. Checks in/out via PIN. Assigned to a department head. |

### Key Relationships
- `user` (department head) → has many `staff` children (via `parent_user_id`)
- `staff` → belongs to one `user` (department head)
- `admin`/`superadmin` → can see and manage everything across all departments
- `user` → scoped to their own department only

---

## 3. Login & Authentication

### Steps
1. Navigate to the app URL
2. Enter your **username** and **password**
3. Click **Login**

### Session
- Sessions persist until logout
- Admin can **impersonate** other users (Admin Mode banner appears at top)
- Click **"Return to Admin"** to stop impersonating

---

## 4. Sidebar Navigation

The sidebar is divided into two collapsible groups (both expanded by default):

### Clinical Group
| Item | Description | Who Sees It |
|------|-------------|-------------|
| Dashboard | Hospital overview with patients, staff, resources | All roles |
| Report | Create/view ISBAR clinical reports | All except staff |
| Department Activity | Staff check-in/out panel | All except staff |
| Resources | Ward resource tracking (nurses, midwives) | All except staff |
| All Records | Search/browse all submitted records | All except staff |
| Analytics | Trend analysis with charts and exports | All except staff |
| Staff Schedule | Weekly schedule with shift assignment | All except staff |

### Admin Group (admin only)
| Item | Description |
|------|-------------|
| Form Builder | Create custom ISBAR form templates |
| Custom Tabs | Create custom dashboard tabs with forms |
| Dashboard Mapping | Map forms to dashboard sections |
| Integrations | External system connections |
| Check-In Logs | Staff attendance history with filters |
| Attendance Reports | Daily/weekly/monthly staff summaries |
| User Management | Create/edit/delete users, set PINs |
| Settings | System configuration |

---

## 5. Clinical Module

### 5.1 Dashboard
The main landing page showing:
- **Patient cards** with expandable details
- **Staff panel** showing who's on/off duty
- **Resource status** (nurses, midwives availability)
- **Activity feed** with recent actions
- **Custom tabs** (configurable by admin)

**How to use:**
- Click a patient card to expand full ISBAR details
- Use tabs at top to switch between views (Clinical, Staff, Resources, Admin)
- Staff names show green (on duty) or gray (off duty)

### 5.2 ISBAR Report
Create structured clinical handover reports.

**ISBAR Format:**
- **I**dentify — Patient name, MRN, department
- **S**ituation — What's happening right now
- **B**ackground — Relevant history
- **A**ssessment — Clinical findings
- **R**ecomendation — Plan of action

**Steps:**
1. Click **Report** in sidebar
2. Select patient (or create new)
3. Fill in each ISBAR section
4. Click **Submit** — record is saved to database

### 5.3 Department Activity
The staff check-in/out panel showing:
- **On Duty** staff (green) — currently checked in
- **Off Duty** staff (gray) — not checked in
- Department filter dropdown (admin only)

**How staff clock in/out:**
1. Click your name in the panel
2. Enter your **4-digit PIN** (or admin can toggle PIN off)
3. Click **Clock In** or **Clock Out**

**See [Section 7](#7-staff-check-inout-workflow) for full details.**

### 5.4 Resources
Track ward resources:
- **Nurses** count and availability
- **Midwives** count and availability
- Visual status indicators (green/amber/red)

### 5.5 All Records
Browse and search all submitted ISBAR records:
- Filter by department, date range, patient
- Search by MRN or patient name
- Click any record to view full details

### 5.6 Analytics
Trend analysis with interactive charts:
- **Department filter** dropdown (admin only)
- **Time range**: Today, 7 days, 30 days, 90 days
- Charts: reports by department, profession, severity
- **Export to Excel** for offline analysis

**Dropdown tip:** The department dropdown is wide enough to show full department names without scrolling.

### 5.7 Staff Schedule
Weekly shift scheduling with Ethiopian calendar:

**Features:**
- **Navigate weeks** with left/right arrows
- **Click Today** to jump to current week
- **Assign shifts**: Click any cell → select shift type (DAY, EVE, NGT, LVE, OFF, ONC)
- **View by department** filter
- **Lock/unlock** schedule (admin only)

**Shift Types:**
| Abbreviation | Meaning |
|-------------|---------|
| DAY | Day Shift |
| EVE | Evening Shift |
| NGT | Night Shift |
| LVE | Leave |
| OFF | Day Off |
| ONC | On-Call |

**Export:**
- **PNG**: Click download icon → full schedule image
- **Excel**: Click document icon → .xls spreadsheet

**See [Section 10](#10-export-features) for export details.**

---

## 6. Admin Module

### 6.1 Form Builder
Create custom ISBAR form templates:
- Define fields (text, dropdown, checkbox, date)
- Set field validation rules
- Assign forms to departments
- Preview before publishing

### 6.2 Custom Tabs
Create custom dashboard tabs with data entry forms.

**Create a new tab:**
1. Click **Custom Tabs** in sidebar
2. Click **Create New Tab**
3. **Step 1**: Enter tab name, select icon, choose view style
4. **Step 2**: Add form fields
5. **Step 3**: Preview and save

**View Styles:**
- **Card** — Grid of cards with form data
- **Table** — Spreadsheet-style view
- **List** — Compact list with icons
- **Compact** — Single-line summary per entry

**Retention Settings:**
- **Forever** — Data kept indefinitely
- **24h** — Auto-delete after 24 hours
- **12h** — Auto-delete after 12 hours
- **8h** — Auto-delete after 8 hours

**Submissions show Ethiopian timestamps.**

### 6.3 Dashboard Mapping
Map custom forms to dashboard sections:
- Select a form from Form Builder
- Choose where it appears on the dashboard
- Set display order and permissions

### 6.4 Integrations
Configure external system connections.

### 6.5 Check-In Logs
Admin view of all staff check-in/out history:

**Filters:**
- **Search** — by staff name, profession, or ward
- **Department** — filter by specific department
- **Date range** — start and end dates

**Table columns:**
- Staff name + profession
- Department
- Shift name
- Check-in time (Ethiopian format)
- Check-out time (Ethiopian format)
- Duration
- Status (Active / Completed)

**Pagination** — 50 records per page

### 6.6 Attendance Reports
Staff attendance summaries:

**Period shortcuts:** Daily, Weekly, Monthly

**Summary cards:**
- Total staff count + currently active
- Total shifts worked
- Total hours worked

**Department breakdown** — horizontal bar chart showing hours per department

**Individual table** — per-staff shifts, hours, and active status

### 6.7 User Management (PIN Reset)
Manage all system users.

**User types visible:**
- Department heads (`user` role)
- Staff members (`staff` role)

**Set/Reset PIN (with password verification):**
1. Click **Set Access PIN** or **Reset** next to a staff member
2. **Step 1**: Enter YOUR password to verify identity
3. **Step 2**: Enter new 4-digit PIN for the staff member
4. Click **Save PIN**

**See [Section 8](#8-pin-management-forgot-password) for full details.**

**Other actions:**
- Create new users (admin only)
- Edit user details
- Toggle active/inactive status
- Delete users
- Rotate staff to different departments

### 6.8 Settings
System-wide configuration options.

---

## 7. Staff Check-In/Out Workflow

### For Staff Members
1. Go to **Department Activity** (or Dashboard staff panel)
2. Find your name in the list
3. Click your name
4. Enter your **4-digit PIN**
5. Click **Clock In** (or **Clock Out** if already on duty)

### For Admin (PIN Bypass)
1. Go to **Department Activity**
2. Click any staff member's name
3. Toggle the **PIN On/Off** button (top right of modal)
4. When OFF, no PIN is required — click **Clock In/Out** directly

### How It Works
- Check-in creates a `shift_sessions` record with timestamp
- Check-out sets `end_time` and marks session inactive
- Auto-checkout runs for expired sessions:
  - **TID** (8-hour shifts): auto after 8 hours
  - **BID** (12-hour shifts): auto after 12 hours
  - **24H/36H/48H**: auto after respective hours

### Notification Bell
- Header shows a **bell icon** with unread count
- Click to see recent check-in/out events
- Auto-updates when staff check in/out

---

## 8. PIN Management (Forgot Password)

### Problem
Staff member forgets their 4-digit PIN and can't clock in.

### Solution — Department Head Resets PIN
1. Go to **User Management** (admin group in sidebar)
2. Find the staff member in the list
3. Click **Set Access PIN** (or **Reset** if PIN exists)
4. **Security step**: Enter YOUR (the department head's) password
5. After verification, enter the new 4-digit PIN for the staff
6. Confirm the PIN
7. Click **Save PIN**

### Security Rules
- **Admin/Superadmin** can reset PINs for ANY staff member
- **Department Head (`user`)** can only reset PINs for staff assigned to them (via `parent_user_id`)
- Password verification is REQUIRED before any PIN change
- Staff cannot reset each other's PINs

---

## 9. Ethiopian Calendar Integration

The app uses the **Ethiopian (Ge'ez) calendar** throughout:

### Date Display
- All dates shown in Ethiopian format: `Hamle 18, 2018`
- Month names: Yekatit, Megabit, Miyazia, Ginbot, Sene, Hamle, Nehase, Pagume, Meskerem, Tikimt, Hidar, Tahsas

### Time Display
- Ethiopian 12-hour clock: `3:40 ቀትር` (morning/afternoon)
- `ማታ` = evening/night

### Schedule Headers
- Each column shows: weekday, Ethiopian day number, Ethiopian month abbreviation
- Weekend days highlighted in gray
- Holidays highlighted in amber
- Today highlighted in cyan

---

## 10. Export Features

### PNG Export (Schedule)
1. Click the **download icon** in the staff schedule header
2. Full schedule captured as high-resolution image
3. Includes all staff names (no truncation) and all dates
4. File: `schedule-{start}-to-{end}.png`

### Excel Export (Schedule)
1. Click the **document icon** in the staff schedule header
2. Downloads `.xls` file with full formatting
3. Includes:
   - Title header with department and date range
   - Column headers with Ethiopian dates
   - Staff rows grouped by profession
   - Shift cells colored by shift type
   - Weekend/holiday/today shading
4. File: `staff-schedule-{department}-{start}-to-{end}.xls`

### Analytics Export
1. Go to **Analytics** page
2. Set your filters (department, time range)
3. Click **Export** button
4. Downloads formatted Excel file

---

## 11. Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't clock in — "Invalid PIN" | Ask department head to reset PIN via User Management |
| Schedule export cut off | Updated — should now show full names. Clear browser cache if still happening |
| Excel export fails | Try PNG export instead, or use Ctrl+P to print |
| Analytics dropdown too narrow | Updated — should now fit full department names |
| Custom tab data disappeared | Check retention setting — may have auto-deleted |
| Staff not showing in panel | Check if staff is active and assigned to correct department |
| Can't see admin items | Verify your role is `admin` or `superadmin` |
| Can't reset staff PIN | Verify the staff is assigned to you (parent_user_id) |
| Notification bell not updating | Refresh page — events update on staff check-in/out |

---

## Quick Reference — Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Print current page |
| `Escape` | Close any open modal/dropdown |

---

## Database Tables Reference

| Table | Purpose |
|-------|---------|
| `users` | All system users with roles, PINs, departments |
| `shift_sessions` | Check-in/out records with timestamps |
| `shift_types` | Shift definitions (DAY, EVE, NGT, etc.) |
| `schedules` | Staff shift assignments per date |
| `holidays` | Holiday calendar |
| `isbar_records` | ISBAR clinical reports |
| `resources` | Ward resource data |
| `custom_tabs` | Custom dashboard tabs (localStorage) |

---

*Document generated for AGH-CSMS v2.0 — Arsho General Hospital*
