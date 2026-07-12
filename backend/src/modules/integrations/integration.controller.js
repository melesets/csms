// Integration configs controller

import * as integrationService from './integration.service.js';

export async function getAll(req, res) {
  try {
    const configs = await integrationService.findAll();
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const config = await integrationService.findById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Integration not found' });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const config = await integrationService.create(req.body);
    res.status(201).json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const config = await integrationService.update(req.params.id, req.body);
    if (!config) return res.status(404).json({ error: 'Integration not found' });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const removed = await integrationService.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Integration not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function toggleActive(req, res) {
  try {
    const config = await integrationService.toggleActive(req.params.id);
    if (!config) return res.status(404).json({ error: 'Integration not found' });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function testConnection(req, res) {
  try {
    const result = await integrationService.testConnection(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function syncPatients(req, res) {
  try {
    const result = await integrationService.syncPatients(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
