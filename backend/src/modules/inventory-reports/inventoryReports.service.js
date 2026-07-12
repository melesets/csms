// Inventory reports service - Sequelize-based report CRUD with shift-based overwrites

import InventoryReport from './inventoryReport.model.js';

export async function findAllReports(department) {
  let where = {};
  if (department) where.department = department;
  return await InventoryReport.findAll({ where, order: [['date', 'DESC']] });
}

export async function createReport(data) {
  const { shift, staffName, staffId, department, date, resources, shift_session_id, co_signers } = data;
  return await InventoryReport.create({
    shift, staffName, staffId, department, date, resources,
    shift_session_id: shift_session_id || null,
    co_signers: co_signers || [],
  });
}
