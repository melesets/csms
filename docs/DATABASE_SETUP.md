# Database Setup & First Login

Since this is a fresh database, you need to create the tables first.

## 1. Run the SQL Schema

You need to run a SQL command to create the tables.
1.  Log in to cPanel.
2.  Open **phpPgAdmin** (the tool for managing your PostgreSQL database).
3.  Select your database (`meleseea_isbar`) on the left.
4.  Click the **SQL** tab.
5.  **Copy and Paste** the code below into the box and click **Execute**:

```sql
-- CREATE TABLES
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    department VARCHAR(100),
    profession VARCHAR(50),
    isActive BOOLEAN DEFAULT TRUE,
    permissions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL,
  profession VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_reports (
    id SERIAL PRIMARY KEY,
    shift VARCHAR(16) NOT NULL CHECK (shift IN ('Morning', 'Evening', 'Night')),
    staffName VARCHAR(100) NOT NULL,
    staffId INTEGER NOT NULL,
    department VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL,
    resources JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES forms(id),
    user_id INTEGER REFERENCES users(id),
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS isbar_records (
  id SERIAL PRIMARY KEY,
  department VARCHAR(100),
  form_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    quantity INTEGER DEFAULT 0,
    standard_quantity INTEGER DEFAULT 0,
    unit VARCHAR(20),
    expiry_date DATE,
    batch_number VARCHAR(50),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_submissions (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES form_templates(id),
    user_id INTEGER REFERENCES users(id),
    data JSONB NOT NULL,
    submitted_by_profession VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dashboard_mappings (
    id SERIAL PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: The admin user will be created automatically by the backend when it restarts!
```

## 2. Restart Backend

After creating the tables:
1.  Go back to **Node.js App** in cPanel.
2.  Click **Restart**.
3.  Wait 10 seconds. (The server will automatically create the admin user now).

## 3. Log In

Go to your website (`https://csms.melesets.com`) and log in with the default admin:

*   **Username**: `quality`
*   **Password**: `isbar1954`

> **Note**: Change this password immediately after logging in!
