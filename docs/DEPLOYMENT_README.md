# ISBAR Application - Deployment Package

## 🎯 Overview

This package contains everything you need to deploy the ISBAR (Identification, Situation, Background, Assessment, Recommendation) healthcare application to YegaraHost.

**Deployment URLs:**
- **Frontend:** https://csms.melesets.com
- **Backend API:** https://backend.melesets.com

---

## 📦 What's Included

### Configuration Files
- `.env.production` - Backend environment template (UPDATE WITH YOUR CREDENTIALS)
- `.env.frontend` - Frontend build configuration
- `vite.config.js` - Updated for subdomain deployment
- `server/src/index.js` - Updated with production CORS and API-only mode

### Documentation
- `DEPLOYMENT_GUIDE.md` - Complete step-by-step deployment instructions
- `DEPLOYMENT_CHECKLIST.md` - Quick checklist for deployment tasks
- `QUICK_START.md` - Quick reference for commands and configuration

### Application Code
- `server/` - Backend Node.js application
- `dist/` - Built frontend files (ready to upload)
- `package.json` - Dependencies and scripts

### Database Files
- `server/isbar_schema.sql` - Main database schema
- `server/migrations/` - Database migration scripts

### Helper Scripts
- `build-production.bat` - Build frontend for production
- `run-dev.bat` - Run development server locally

---

## 🚀 Quick Start

### 1. Update Environment Variables

**Edit `.env.production`** with your YegaraHost database credentials:
```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/YOUR_DB
PGUSER=YOUR_USER
PGPASSWORD=YOUR_PASSWORD
PGDATABASE=YOUR_DB
```

### 2. Build Frontend (Already Done!)

The `dist` folder is ready to upload. If you need to rebuild:
```powershell
.\build-production.bat
```

### 3. Deploy Backend

1. Upload these files to `backend.melesets.com`:
   - `server/` folder
   - `package.json`
   - `package-lock.json`
   - `.env` (rename `.env.production` and fill in credentials)

2. In cPanel → Setup Node.js App:
   - Application root: `/home/username/backend.melesets.com`
   - Startup file: `server/src/index.js`
   - Port: 4000

3. Run `npm install` and start the app

### 4. Deploy Frontend

1. Upload all contents of `dist/` folder to `csms.melesets.com`
2. Create `.htaccess` file (see QUICK_START.md)
3. Enable SSL for both domains

### 5. Setup Database

1. Create PostgreSQL database in cPanel
2. Import `server/isbar_schema.sql`
3. Run migration files from `server/migrations/`

---

## 📚 Documentation

For detailed instructions, see:
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment walkthrough
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step checklist
- **[QUICK_START.md](./QUICK_START.md)** - Quick reference guide

---

## 🔑 Default Login

After deployment, login with:
- **Username:** quality
- **Password:** isbar1954

⚠️ **IMPORTANT:** Change this password immediately after first login!

---

## ✅ Deployment Checklist

- [ ] Database created and schema imported
- [ ] Backend deployed to backend.melesets.com
- [ ] Frontend deployed to csms.melesets.com
- [ ] SSL enabled for both domains
- [ ] Application tested and working
- [ ] Default password changed

---

## 🆘 Need Help?

1. Check the troubleshooting section in `DEPLOYMENT_GUIDE.md`
2. Verify all environment variables are set correctly
3. Check cPanel logs for errors
4. Contact YegaraHost support if needed

---

## 📊 Application Features

- **ISBAR Records** - Create and manage patient handover records
- **Form Builder** - Create custom forms for different departments
- **Resource Management** - Track medical supplies and equipment
- **User Management** - Role-based access control
- **Dashboard** - Real-time analytics and trends
- **Ethiopian Calendar** - Built-in Ethiopian date support

---

## 🔧 Technical Stack

- **Frontend:** React + TypeScript + Vite + Ant Design
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Hosting:** YegaraHost cPanel

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Prepared for:** YegaraHost Deployment
