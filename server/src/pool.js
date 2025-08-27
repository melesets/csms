import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Single shared Pool for the whole backend
// Prefer DATABASE_URL if provided; otherwise construct from individual PG* vars, then fallback to a sane local default
const connectionString = process.env.DATABASE_URL
  || (process.env.PGUSER && process.env.PGHOST && process.env.PGDATABASE
      ? `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
      : 'postgresql://postgres:1954@localhost:1212/ISBAR');

const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 5000),
});

export default pool;
