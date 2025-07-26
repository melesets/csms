// Sequelize instance for ES module backend
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/isbar_db',
  {
    dialect: 'postgres',
    logging: false,
  }
);

export default sequelize;
