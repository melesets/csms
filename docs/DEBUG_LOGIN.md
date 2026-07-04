# How to Debug "Spinning" Login

If the screen just spins, we need to inspect the network traffic to see what error the server is secretly sending.

## Step 1: Open Developer Tools
1.  On the login page, right-click anywhere and select **Inspect**.
2.  Or press **F12** on your keyboard.
3.  Click the tab named **Network** (at the top of the new panel).

## Step 2: Capture the Error
1.  Make sure the Network tab is open.
2.  **Try to Log In** again with your username/password.
3.  You will see a new line appear in the Network list (usually named `login`).

## Step 3: Check the Status
1.  Look at the line named `login` (in red text usually).
2.  Click on it.
3.  On the right side, click the **Response** tab.
4.  **What does it say?**
    *   `Failed to fetch` -> Connection blocked (CORS or server down).
    *   `{"error": "..."}` -> The server replied with a specific reason.
    *   `500 Internal Server Error` -> The code crashed.

**Tell me what you see in the Response tab!**
