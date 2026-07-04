# ISBAR Application - YegaraHost Deployment Guide

Complete step-by-step guide for deploying the ISBAR healthcare application to YegaraHost.

## 📋 Prerequisites

- YegaraHost account with cPanel access
- PostgreSQL database support
- Node.js support (cPanel Node.js application feature)
- Two subdomains configured:
  - `backend.melesets.com` - Backend API server
  - `csms.melesets.com` - Frontend application

---

## 🗂️ Deployment Overview

The ISBAR application consists of two parts:

1. **Backend** (Node.js + Express + PostgreSQL) → `backend.melesets.com`
2. **Frontend** (React + Vite static files) → `csms.melesets.com`

---

## Part 1: Database Setup

### Step 1: Create PostgreSQL Database

1. Log in to **cPanel**
2. Navigate to **Databases** → **PostgreSQL Databases**
3. Create a new database:
   - Database name: `isbar_db` (or your preferred name)
   - Click **Create Database**
4. Create a database user:
   - Username: `isbar_user` (or your preferred username)
   - Password: Create a strong password
   - Click **Create User**
5. Add user to database:
   - Select the user and database
   - Grant **ALL PRIVILEGES**
   - Click **Add**

**📝 Note:** Save these credentials - you'll need them for the `.env` file!

### Step 2: Import Database Schema

1. In cPanel, go to **Databases** → **phpPgAdmin** (or PostgreSQL management tool)
2. Select your database (`isbar_db`)
3. Click **SQL** tab
4. Copy and paste the contents of `server/isbar_schema.sql`
5. Click **Execute**
6. Run all migration files from `server/migrations/` folder in order (by date)

**Alternative:** Use the provided script:
```bash
# On your local machine, upload the schema file and run:
psql -h localhost -U isbar_user -d isbar_db -f server/isbar_schema.sql
```

---

## Part 2: Backend Deployment (backend.melesets.com)

### Step 1: Prepare Backend Files

On your local machine:

1. **Update `.env.production` file** with your database credentials:
   ```env
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=postgresql://isbar_user:YOUR_PASSWORD@localhost:5432/isbar_db
   PGUSER=isbar_user
   PGHOST=localhost
   PGDATABASE=isbar_db
   PGPASSWORD=YOUR_PASSWORD
   PGPORT=5432
   VITE_API_BASE=/api
   CORS_ORIGIN=https://csms.melesets.com
   SESSION_SECRET=GENERATE_A_RANDOM_SECRET_HERE
   ```

2. **Create backend deployment package:**
   - Create a folder called `backend-deploy`
   - Copy these files/folders into it:
     ```
     backend-deploy/
     ├── server/
     │   ├── src/
     │   ├── routes/
     │   ├── migrations/
     │   └── isbar_schema.sql
     ├── node_modules/ (optional - can install on server)
     ├── package.json
     ├── package-lock.json
     └── .env (rename .env.production to .env)
     ```

### Step 2: Upload Backend to cPanel

1. In cPanel, go to **File Manager**
2. Navigate to the directory for `backend.melesets.com` (usually `public_html/backend` or similar)
3. Upload the `backend-deploy` folder contents
4. Or use **FTP** to upload files (faster for large uploads)

### Step 3: Configure Node.js Application in cPanel

1. In cPanel, go to **Software** → **Setup Node.js App**
2. Click **Create Application**
3. Configure:
   - **Node.js version:** Select latest LTS (18.x or 20.x)
   - **Application mode:** Production
   - **Application root:** Path to your backend folder (e.g., `/home/username/backend.melesets.com`)
   - **Application URL:** `backend.melesets.com`
   - **Application startup file:** `server/src/index.js`
   - **Port:** 4000 (or any available port)
4. Click **Create**

### Step 4: Install Dependencies

1. In the Node.js App interface, click **Run NPM Install**
2. Or use the **Terminal** in cPanel:
   ```bash
   cd /home/username/backend.melesets.com
   npm install --production
   ```

### Step 5: Set Environment Variables

1. In the Node.js App interface, click **Environment Variables**
2. Add each variable from your `.env` file:
   - `NODE_ENV` = `production`
   - `PORT` = `4000`
   - `DATABASE_URL` = `postgresql://isbar_user:password@localhost:5432/isbar_db`
   - etc.

### Step 6: Start the Backend

1. Click **Start App** or **Restart App**
2. Verify it's running by visiting: `https://backend.melesets.com`
3. You should see:
   ```json
   {
     "message": "ISBAR Backend API Server",
     "version": "1.0.0",
     "status": "running"
   }
   ```

---

## Part 3: Frontend Deployment (csms.melesets.com)

### Step 1: Build Frontend for Production

On your local machine:

1. **Create `.env` file** in the project root:
   ```env
   VITE_API_URL=https://backend.melesets.com
   ```

2. **Build the frontend:**
   ```powershell
   cd C:\ISBAR_4
   npm run build:production
   ```

3. This creates a `dist` folder with all static files

### Step 2: Upload Frontend Files

1. In cPanel **File Manager**, navigate to `csms.melesets.com` directory (usually `public_html/csms` or the document root)
2. Upload **all contents** of the `dist` folder:
   ```
   csms.melesets.com/
   ├── index.html
   ├── assets/
   │   ├── index-[hash].js
   │   ├── index-[hash].css
   │   └── ...
   └── vite.svg
   ```

### Step 3: Configure .htaccess for SPA Routing

Create a `.htaccess` file in the `csms.melesets.com` directory:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

This ensures React Router works correctly.

---

## Part 4: SSL Certificate Setup

### For Both Subdomains:

1. In cPanel, go to **Security** → **SSL/TLS Status**
2. Select both `backend.melesets.com` and `csms.melesets.com`
3. Click **Run AutoSSL**
4. Wait for certificates to be issued (usually 1-2 minutes)

---

## Part 5: Testing & Verification

### Test Backend API

1. Visit `https://backend.melesets.com/api/health`
   - Should return: `{"ready": true}`

2. Test database connection: `https://backend.melesets.com/api/test-db`
   - Should return: `{"success": true, "message": "Database connection successful."}`

### Test Frontend

1. Visit `https://csms.melesets.com`
2. You should see the ISBAR login page
3. Try logging in with default admin credentials:
   - Username: `quality`
   - Password: `isbar1954`

### Test Full Integration

1. Log in to the frontend
2. Try creating a new ISBAR record
3. Verify data is saved to the database
4. Check that all features work:
   - Dashboard
   - Forms
   - Resources
   - User management

---

## 🔧 Troubleshooting

### Backend Issues

**Problem:** Backend not starting
- Check Node.js app logs in cPanel
- Verify environment variables are set correctly
- Check database connection credentials

**Problem:** "Unable to set environment variables in htaccess file" (Error: No such file or directory)
- **Cause:** This usually means your backend folder is **empty**.
- **Fix:** You must upload and **extract** the backend files *before* clicking "Save" or "Add Variable" in the Node.js setup. cPanel needs the files to be there to create the configuration.

**Problem:** "404 Not Found ... Powered by LiteSpeed"
- **Cause:** The Node.js application is **not running**.
- **Fix:** 
  1. Go to "Setup Node.js App" in cPanel.
  2. Click the **Pencil icon** to edit your app.
  3. Ensure "Application mode" is **Production**.
  4. Ensure "Application startup file" is `server/src/index.js`.
  5. Click **Run NPM Install** (if you haven't yet).
  6. Click **START APP** (or Restart).
  7. Verify: Visiting `https://backend.melesets.com` should show JSON output.

**Problem:** "503 Service Unavailable"
- **Cause:** The app is running but cannot connect to the database. It crashes or rejects requests.
- **Fix:** 
  1. Check your **Environment Variables** in cPanel.
  2. Verify:
     - `DATABASE_URL` is correct.
     - `PGUSER`, `PGPASSWORD`, `PGDATABASE` match what you created in cPanel.
     - `PGHOST` is `localhost` (usually) or the specific IP provided by YegaraHost.
  3. **Check Logs:** Click "stderr.log" in the cPanel Node.js interface to see the exact connection error.
**Problem:** Blank page or 404 errors
- Verify `.htaccess` file is present
- Check browser console for errors
- Ensure `VITE_API_URL` was set correctly during build

### Connection Issues (Frontend cannot talk to Backend)

**Problem:** Infinite loading spinner or "Network Error" on login
- **Check API URL:** Open Browser DevTools -> Network tab. Check the request URL.
  - Correct: `https://backend.melesets.com/api/login`
  - Incorrect: `https://csms.melesets.com/api/login` (means build config was wrong)
- **Fix:** 
  1. Ensure `.env.frontend` has `VITE_API_URL=https://backend.melesets.com/api`
  2. Run `npm run build:production` locally
  3. Re-upload `dist` folder to `csms.melesets.com`

**Problem:** CORS Error
- Verify `CORS_ORIGIN=https://csms.melesets.com` in backend `.env`
- Ensure both domains have valid SSL certificates

### Database Issues

**Problem:** Connection errors
- Verify PostgreSQL credentials
- Check that database exists
- Ensure user has proper permissions

---

## 📦 Files Included in Deployment Package

- `server/` - Backend application code
- `dist/` - Built frontend files (after running `npm run build`)
- `.env.production` - Backend environment template
- `.env.frontend` - Frontend environment template
- `server/isbar_schema.sql` - Database schema
- `server/migrations/` - Database migration files
- `DEPLOYMENT_GUIDE.md` - This file

---

## 🎉 Deployment Complete!

Your ISBAR application should now be live at:
- **Frontend:** https://csms.melesets.com
- **Backend API:** https://backend.melesets.com

For support or issues, check the troubleshooting section or contact YegaraHost support.
