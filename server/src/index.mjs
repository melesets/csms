import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import inventoryReportsRouter from './routes/inventoryReports.js';
import formTemplatesRouter from './routes/formTemplates.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/api/inventory-reports', inventoryReportsRouter);
app.use('/api/form-templates', formTemplatesRouter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1954@localhost:1212/ISBAR',
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'ISBAR',
  password: process.env.PGPASSWORD || '1954',
  port: process.env.PGPORT || 1212
});

// ...existing endpoints (copy all your endpoints here, replacing require with import as above)...

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
