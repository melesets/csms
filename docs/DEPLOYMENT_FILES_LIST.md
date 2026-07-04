# Deployment File Checklist

Use this checklist to ensure you upload exactly what is needed and nothing else.

## 1. Backend (backend.melesets.com)

**Action**: ZIP the following files/folders from inside the `server/` folder of your project found at `c:\ISBAR_4\server\`.

### ✅ INCLUDE these:
-   `package.json`
-   `package-lock.json`
-   `index.js` _(The new entry point I created)_
-   `src/` _(Folder containing all backend code)_
-   `ecosystem.config.cjs` _(Optional, good to have)_
-   `scripts/` _(Optional, if any startup scripts are needed)_

### ❌ DO NOT Upload:
-   `node_modules/` _(Install these on the server via cPanel button)_
-   `logs/`
-   `.env` _(It is safer to set Environment Variables in cPanel interface)_
-   `test_department_filter.cjs` and other test scripts

**After Uploading**:
1.  Extract the ZIP.
2.  Click **Run NPM Install** in cPanel Node.js App.

---

## 2. Frontend (csms.melesets.com)

**Action**: First, run `npm run build:production` on your computer. This creates a `dist` folder.

**Upload Location**: Your subdomain folder (e.g., `public_html/csms`).

### ✅ INCLUDE these (contents of `dist`):
-   `assets/` _(Folder)_
-   `index.html`
-   `vite.svg` _(If present)_
-   `.htaccess` _(Create this manually as per guide, or upload if you made it)_

### ❌ DO NOT Upload:
-   `node_modules/`
-   `src/`
-   `public/`
-   `package.json`
-   `vite.config.ts`
-   Anything outside the `dist` folder.
