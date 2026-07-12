// Integration configs service - CRUD + sync for external system connections
// SAFETY: syncPatients and testConnection are READ-ONLY. They only send GET requests
// to external systems. No data is ever written, updated, or deleted on external systems.

import pool from '../../config/database.js';

// Read-only HTTP methods only — never POST/PUT/DELETE to external systems
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export async function findAll() {
  const result = await pool.query('SELECT * FROM integration_configs ORDER BY created_at DESC');
  return result.rows;
}

export async function findById(id) {
  const result = await pool.query('SELECT * FROM integration_configs WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function create(data) {
  const result = await pool.query(
    `INSERT INTO integration_configs (name, type, base_url, auth_type, auth_config, field_mappings, sync_settings, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.name, data.type, data.base_url || null, data.auth_type || 'none',
     JSON.stringify(data.auth_config || {}), JSON.stringify(data.field_mappings || []),
     JSON.stringify(data.sync_settings || {}), data.is_active ?? false, data.created_by || 'admin']
  );
  return result.rows[0];
}

export async function update(id, data) {
  const result = await pool.query(
    `UPDATE integration_configs SET
       name = COALESCE($1, name), type = COALESCE($2, type), base_url = COALESCE($3, base_url),
       auth_type = COALESCE($4, auth_type), auth_config = COALESCE($5, auth_config),
       field_mappings = COALESCE($6, field_mappings), sync_settings = COALESCE($7, sync_settings),
       is_active = COALESCE($8, is_active), updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [data.name ?? null, data.type ?? null, data.base_url ?? null, data.auth_type ?? null,
     data.auth_config ? JSON.stringify(data.auth_config) : null,
     data.field_mappings ? JSON.stringify(data.field_mappings) : null,
     data.sync_settings ? JSON.stringify(data.sync_settings) : null,
     data.is_active ?? null, id]
  );
  return result.rows[0] || null;
}

export async function remove(id) {
  const result = await pool.query('DELETE FROM integration_configs WHERE id = $1 RETURNING *', [id]);
  return result.rows.length > 0;
}

export async function toggleActive(id) {
  const result = await pool.query(
    `UPDATE integration_configs SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

export async function testConnection(id) {
  const config = await findById(id);
  if (!config) throw new Error('Integration not found');
  if (!config.base_url) throw new Error('No base URL configured');

  try {
    const headers = buildAuthHeaders(config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // READ-ONLY: GET request only — never writes to external system
    const res = await fetch(config.base_url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    return {
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
      message: res.ok ? 'Connection successful' : `HTTP ${res.status}: ${res.statusText}`
    };
  } catch (err) {
    return { success: false, status: 0, message: err.message || 'Connection failed' };
  }
}

export async function syncPatients(id) {
  const config = await findById(id);
  if (!config) throw new Error('Integration not found');
  if (!config.base_url) throw new Error('No base URL configured');

  const startTime = Date.now();
  try {
    const headers = buildAuthHeaders(config);
    const patientUrl = resolveUrl(config.base_url, '/patient');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(patientUrl, {
      method: 'GET',  // READ-ONLY: never writes to external system
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const data = await res.json();
    const patients = Array.isArray(data) ? data : (data.results || data.content || data.patients || []);
    const mapped = patients.map(p => mapPatientFields(p, config.field_mappings));

    const duration = Date.now() - startTime;
    await pool.query(
      `UPDATE integration_configs SET last_sync_at = NOW(), last_sync_status = 'success',
       last_sync_message = 'Synced ' || $1 || ' patients in ' || $2 || 'ms', updated_at = NOW() WHERE id = $3`,
      [mapped.length, duration, id]
    );

    return { success: true, count: mapped.length, patients: mapped, duration };
  } catch (err) {
    await pool.query(
      `UPDATE integration_configs SET last_sync_at = NOW(), last_sync_status = 'error',
       last_sync_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, id]
    );
    return { success: false, message: err.message };
  }
}

function buildAuthHeaders(config) {
  const headers = { 'Accept': 'application/json' };
  const authType = config.auth_type || 'none';
  const authConfig = config.auth_config || {};

  if (authType === 'basic' && authConfig.username) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${authConfig.username}:${authConfig.password || ''}`).toString('base64');
  } else if (authType === 'bearer' && authConfig.token) {
    headers['Authorization'] = `Bearer ${authConfig.token}`;
  } else if (authType === 'custom' && authConfig.header_name && authConfig.header_value) {
    headers[authConfig.header_name] = authConfig.header_value;
  }

  return headers;
}

function resolveUrl(base, path) {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : '/' + path;
  return b + p;
}

function mapPatientFields(sourceData, mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) return sourceData;
  const result = {};
  for (const mapping of mappings) {
    const sourceField = mapping.source;
    const targetField = mapping.target;
    if (sourceField && targetField) {
      result[targetField] = sourceData[sourceField] ?? null;
    }
  }
  return result;
}
