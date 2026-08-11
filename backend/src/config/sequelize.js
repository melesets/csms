// Sequelize ORM connection for models that require it
// Configures the Sequelize instance with PostgreSQL dialect and SSL support.
// Used by model definitions that leverage Sequelize associations and hooks.

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const sequelize = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
  {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  }
);

export default sequelize;
