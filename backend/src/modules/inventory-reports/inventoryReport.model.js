// Inventory report Sequelize model - maps to inventory_reports table

import { DataTypes } from 'sequelize';
import sequelize from '../../config/sequelize.js';

const InventoryReport = sequelize.define('InventoryReport', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'id',
  },
  shift: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'shift',
  },
  shift_session_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'shift_session_id',
  },
  staffName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'staffname',
  },
  staffId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'staffid',
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
