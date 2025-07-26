-- Inventory Reports Table
CREATE TABLE IF NOT EXISTS inventory_reports (
    id SERIAL PRIMARY KEY,
    shift VARCHAR(16) NOT NULL CHECK (shift IN ('Morning', 'Evening', 'Night')),
    staffName VARCHAR(100) NOT NULL,
    staffId INTEGER NOT NULL,
    department VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL,
    resources JSONB NOT NULL
);
-- ISBAR Database Schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
