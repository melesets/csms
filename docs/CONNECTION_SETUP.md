# How to "Connect" Frontend & Backend

Since you have already uploaded the files, the files themselves are ready. The "connection" now happens through **Configuration** in your cPanel.

## 1. Connect Backend to Frontend (Enable CORS)

Your backend needs to know it's allowed to talk to your frontend.

1.  Log in to **cPanel** > **Setup Node.js App**.
2.  Edit your `isbar-backend` application.
3.  Find the **Environment Variables** section.
4.  **CRITICAL STEP**: Add this variable:
    *   **Name**: `NODE_ENV`
    *   **Value**: `production`
5.  Click **Save** and then **Restart Application**.
    *   *Why?* Your code specifically checks for `production` mode to allow requests from `https://csms.melesets.com`. without this, it blocks the connection.

## 2. Connect Backend to Database

Your backend needs to find your database.

1.  In the same **Environment Variables** section:
    *   **Name**: `DATABASE_URL`
    *   **Value**: Your PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/db`).
2.  Click **Save** and **Restart**.

## 3. Verify the Connection

1.  Open your browser to `https://csms.melesets.com`.
2.  Open the **Developer Tools** (F12) and go to the **Network** tab.
3.  Try to **Log In**.
4.  Look for a request to `login`.
    *   **Status 200**: Success! Connected.
    *   **Status 503**: Backend server is crashed (check cPanel logs).
    *   **Status CORS Error**: `NODE_ENV` was not set to `production`.
