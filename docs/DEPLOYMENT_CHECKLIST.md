# ISBAR Deployment Checklist

Quick reference checklist for deploying to YegaraHost.

## Pre-Deployment

- [ ] Update `.env.production` with YegaraHost database credentials
- [ ] Update `.env.frontend` with backend URL (`https://backend.melesets.com/api`)
- [ ] Test application locally with `npm run dev`
- [ ] Commit all changes to Git

## Database Setup

- [ ] Create PostgreSQL database in cPanel
- [ ] Create database user with strong password
- [ ] Grant ALL PRIVILEGES to user
- [ ] Import `server/isbar_schema.sql`
- [ ] Run all migration files from `server/migrations/`
- [ ] Verify tables created successfully

## Backend Deployment (backend.melesets.com)

- [ ] Create backend deployment folder
- [ ] Copy server files (server/, package.json, .env)
- [ ] Upload to cPanel File Manager or via FTP
- [ ] Configure Node.js App in cPanel
  - [ ] Set Application root
  - [ ] Set startup file: `server/src/index.js`
  - [ ] Set port: 4000
- [ ] Run `npm install` in cPanel terminal
- [ ] Set environment variables in Node.js App
- [ ] Start the application
- [ ] Test: Visit `https://backend.melesets.com/api/health`

## Frontend Deployment (csms.melesets.com)

- [ ] Build frontend: `npm run build:production`
- [ ] Verify `dist` folder created
- [ ] Upload all `dist` contents to `csms.melesets.com` directory
- [ ] Create `.htaccess` file for SPA routing
- [ ] Test: Visit `https://csms.melesets.com`

## SSL & Security

- [ ] Enable AutoSSL for `backend.melesets.com`
- [ ] Enable AutoSSL for `csms.melesets.com`
- [ ] Verify HTTPS works for both domains
- [ ] Test CORS - frontend should connect to backend

## Final Testing

- [ ] Login with default credentials (quality/isbar1954)
- [ ] Create a test ISBAR record
- [ ] Verify data saves to database
- [ ] Test all major features:
  - [ ] Dashboard
  - [ ] Forms
  - [ ] Resources
  - [ ] User Management
- [ ] Test on mobile device
- [ ] Check browser console for errors

## Post-Deployment

- [ ] Change default admin password
- [ ] Create additional user accounts
- [ ] Set up database backups in cPanel
- [ ] Monitor application logs
- [ ] Document any custom configurations

---

**Deployment Date:** _____________

**Deployed By:** _____________

**Notes:**
