// server/src/models/inventoryReport.js

import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const InventoryReport = sequelize.define('InventoryReport', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'id',
  },
  shift: {
    type: DataTypes.ENUM('Morning', 'Evening', 'Night'),
    allowNull: false,
    field: 'shift',
  },
  staffName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'staff_name',
  },
  staffId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'staff_id',
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'department',
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'date',
  },
  resources: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'resources',
  },
}, {
  tableName: 'inventory_reports',
  timestamps: false,
});

export default InventoryReport;
