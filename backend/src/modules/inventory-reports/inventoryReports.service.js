// Inventory reports service - Sequelize-based report CRUD with shift-based overwrites

import InventoryReport from './inventoryReport.model.js';
import pool from '../../config/database.js';

export async function findAllReports(department, parentUserId) {
  if (parentUserId) {
    const conditions = [];
    const params = [];
    if (department) {
      params.push(department);
      conditions.push(`ir.department = $${params.length}`);
    }
    params.push(parentUserId);
    conditions.push(`(ir.staffid IN (SELECT id FROM users WHERE parent_user_id = $${params.length}) OR ir.staffid = $${params.length})`);
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT ir.* FROM inventory_reports ir ${whereClause} ORDER BY ir.date DESC`,
      params
    );
    return rows;
  }
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
