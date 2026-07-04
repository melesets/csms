# Quick Start - Deployment Commands

## Local Build Commands

### Build Frontend for Production
```powershell
# Set the API URL
$env:VITE_API_URL="https://backend.melesets.com/api"

# Build the frontend
npm run build:production
```

### Test Backend Locally
```powershell
# Set environment to production
$env:NODE_ENV="production"

# Start backend server
npm run start:backend
```

## Files to Upload

### Backend (backend.melesets.com)
Upload these files/folders:
- `server/` (entire folder)
- `package.json`
- `package-lock.json`
- `.env` (renamed from `.env.production` with your credentials filled in)

### Frontend (csms.melesets.com)
Upload contents of `dist/` folder:
- `index.html`
- `assets/` (folder)
- `vite.svg`
- All other files in `dist/`

## Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/YOUR_DB
PGUSER=YOUR_USER
PGHOST=localhost
PGDATABASE=YOUR_DB
PGPASSWORD=YOUR_PASSWORD
PGPORT=5432
VITE_API_BASE=/api
CORS_ORIGIN=https://csms.melesets.com
SESSION_SECRET=YOUR_RANDOM_SECRET
```

### Frontend (build time)
```env
VITE_API_URL=https://backend.melesets.com
```

## .htaccess for Frontend
Create this file in csms.melesets.com directory:

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

## Testing URLs

- Backend API: https://backend.melesets.com
- Backend Health: https://backend.melesets.com/api/health
- Frontend: https://csms.melesets.com
- Login: quality / isbar1954
