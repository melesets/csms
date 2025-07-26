// server/src/models/inventoryReport.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const InventoryReport = sequelize.define('InventoryReport', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  shift: {
    type: DataTypes.ENUM('Morning', 'Evening', 'Night'),
    allowNull: false,
  },
  staffName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  staffId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  resources: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
}, {
  tableName: 'inventory_reports',
  timestamps: false,
});

module.exports = InventoryReport;
