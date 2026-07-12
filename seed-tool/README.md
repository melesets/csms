# ISBAR Data Seed Tool

Export users, forms, resources from ISBAR_4 and seed into your new app's database on another computer.

## How it works

```
Production Machine              New Computer
─────────────────              ──────────────
ISBAR_4 DB ──→ export.js ──→ export.json ──→ seed.js ──→ New App DB
```

---

## Step 1: On the PRODUCTION machine (where ISBAR_4 runs)

```bash
cd seed-tool
npm install
npm run export
```

This creates `export.json` with all your users, forms, and resources.

## Step 2: Copy `export.json` to the new computer

Transfer `seed-tool/export.json` via:
- USB drive
- Network share
- Email / file transfer
- `scp` / `rsync`

## Step 3: On the NEW computer

```bash
# Copy the seed-tool folder to the new computer, then:
cd seed-tool
npm install
```

Edit `.env` with your new app's database credentials:
```
TARGET_PGHOST=localhost
TARGET_PGPORT=5432
TARGET_PGDATABASE=new_app_db
TARGET_PGUSER=postgres
TARGET_PGPASSWORD=your_password
```

Create tables and seed data:
```bash
npm run schema
npm run seed
```

## What gets copied

| Table | Data |
|---|---|
| `users` | All user accounts (username, role, department, profession, permissions) |
| `form_templates` | All form templates with fields and sections |
| `resources` | All drugs and equipment |
| `department_staff` | Staff per department |
| `dashboard_mappings` | Dashboard card configs |

**NOT copied:** form_submissions, isbar_records, inventory_reports (operational data).

## Re-sync later

Whenever production data changes, re-run on production:
```bash
npm run export
```
Copy the new `export.json` and re-run on the new computer:
```bash
npm run seed
```
