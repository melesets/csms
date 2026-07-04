# Deploying ISBAR Frontend to Yegara Host

This guide covers deploying the frontend to `csms.melesets.com`.

## Prerequisites

1.  **Backend Deployed**: You should have already deployed the backend to `backend.melesets.com`.
2.  **Subdomain Created**: Ensure `csms.melesets.com` is created in your cPanel.

## Step 1: Build the Frontend

1.  Open your terminal in the project root.
2.  Run the build command:
    ```bash
    npm run build:production
    ```
3.  This will create a `dist` folder in your project directory. This folder contains the production-ready HTML, CSS, and JavaScript files.

## Step 2: Upload to cPanel

1.  Log in to **cPanel**.
2.  Open **File Manager**.
3.  Navigate to the **document root** for your subdomain `csms.melesets.com`.
    *   This is usually `public_html/csms` or a folder named `csms.melesets.com`.
4.  **Delete** any existing files in that folder (if any).
5.  **Upload** the contents of your local `dist` folder.
    *   *Tip: You can zip the contents of `dist`, upload the zip, and then extract it in the file manager for faster upload.*
6.  Ensure `index.html` is in the main folder of your subdomain.

## Step 3: Handle Routing (Important for React)

Since this is a Single Page Application (SPA), we need to tell the server to redirect all requests to `index.html` so React Router works.

1.  In the same folder on cPanel (`csms.melesets.com`), create a new file named `.htaccess`.
2.  Edit the file and paste the following code:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```

## Step 4: Verify

1.  Visit `https://csms.melesets.com`.
2.  Try logging in. It should talk to `https://backend.melesets.com/api`.
