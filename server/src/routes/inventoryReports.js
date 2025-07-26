// server/src/routes/inventoryReports.js

import express from 'express';
import InventoryReport from '../models/inventoryReport.js';
const router = express.Router();

// Get all reports (admin) or by department
router.get('/', async (req, res) => {
  try {
    const { department } = req.query;
    let where = {};
    if (department) where.department = department;
    const reports = await InventoryReport.findAll({ where, order: [['date', 'DESC']] });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new report
router.post('/', async (req, res) => {
  try {
    const { shift, staffName, staffId, department, date, resources } = req.body;
    if (!shift || !staffName || !staffId || !department || !date || !resources) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const report = await InventoryReport.create({ shift, staffName, staffId, department, date, resources });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
