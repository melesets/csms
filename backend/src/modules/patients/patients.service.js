// Patients service - extracts patient data from form submissions by MRN
// Queries form_submissions to build patient lists and lookups

import pool from '../../config/database.js';

export async function findAllPatients(department) {
  let query = `
    SELECT DISTINCT ON (mrn_val)
      id, form_data, template_name, template_department, submitted_at, submitted_by_name,
      COALESCE(
        form_data->>'mrn', form_data->>'MRN', form_data->>'patient_mrn',
        form_data->>'patientMrn', form_data->>'_mrn'
      ) AS mrn_val
    FROM form_submissions
    WHERE COALESCE(
      form_data->>'mrn', form_data->>'MRN', form_data->>'patient_mrn',
      form_data->>'patientMrn', form_data->>'_mrn'
    ) IS NOT NULL
    AND COALESCE(
      form_data->>'mrn', form_data->>'MRN', form_data->>'patient_mrn',
      form_data->>'patientMrn', form_data->>'_mrn'
    ) != ''
  `;
  const params = [];
  let idx = 1;

  if (department) {
    query += ` AND (template_department = $${idx} OR form_data->>'department' = $${idx})`;
    params.push(department);
    idx++;
  }

  query += ` ORDER BY mrn_val, submitted_at DESC`;
  const result = await pool.query(query, params);

  return result.rows.map(row => {
    const fd = row.form_data || {};
    const findVal = (keys) => {
      for (const k of keys) {
        if (fd[k] !== undefined && fd[k] !== null && fd[k] !== '') return fd[k];
      }
      return '';
    };
    return {
      id: row.id,
      mrn: row.mrn_val,
      patientName: findVal(['patientName', 'Patient Name', 'Patient name', 'patient_name', 'PatientName', 'name', 'Name', 'Client Name', 'clientName', 'Client name']),
      age: findVal(['Age', 'age', 'patientAge']) || null,
      gender: findVal(['Gender', 'gender', 'sex', 'Sex']) || 'N/A',
      bedNumber: findVal(['BN', 'bedNumber', 'Bed Number', 'bed_number', 'bn', 'Bed', 'bed', 'bedNo', 'BedNo']),
      diagnosis: findVal(['diagnosis', 'Diagnosis', 'background', 'situation', 'condition']),
      stability: findVal(['stability', 'Patient Stability']) || 'stable',
      department: row.template_department || findVal(['department', 'Department']) || 'General',
      lastHandover: row.submitted_at,
      assignedNurse: row.submitted_by_name || 'Unknown',
      formData: fd,
      fieldLabels: {},
    };
  });
}

async function queryPatientByMrn(mrn, department) {
  let query = `
    SELECT form_data, template_name, template_department, submitted_at, submitted_by_name
    FROM form_submissions WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  query += ` AND (
    form_data->>'mrn' = $${idx} OR form_data->>'MRN' = $${idx} OR 
    form_data->>'patient_mrn' = $${idx} OR form_data->>'patientMrn' = $${idx} OR
    form_data->>'_mrn' = $${idx}
  )`;
  params.push(mrn);
  idx++;

  if (department) {
    query += ` AND template_department = $${idx}`;
    params.push(department);
    idx++;
  }

  query += ' ORDER BY submitted_at DESC LIMIT 1';
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function findPatientByMrn(mrn, department) {
  // Prefer the department-scoped match, but fall back to a global search so MRN
  // auto-population still works when the patient record was created under a
  // different department than the current form's template.
  const scoped = await queryPatientByMrn(mrn, department);
  if (scoped) return scoped;
  if (department) return await queryPatientByMrn(mrn, null);
  return null;
}

export async function findMrns(department) {
  let query = `
    SELECT DISTINCT 
      COALESCE(form_data->>'mrn', form_data->>'MRN', form_data->>'patient_mrn', form_data->>'patientMrn', form_data->>'_mrn') as mrn,
      COALESCE(form_data->>'patientName', form_data->>'Patient name', form_data->>'patient_name', form_data->>'clientName', form_data->>'Client Name') as patient_name
    FROM form_submissions 
    WHERE COALESCE(form_data->>'mrn', form_data->>'MRN', form_data->>'patient_mrn', form_data->>'patientMrn', form_data->>'_mrn') IS NOT NULL
    AND COALESCE(form_data->>'mrn', form_data->>'MRN', form_data->>'patient_mrn', form_data->>'patientMrn', form_data->>'_mrn') != ''
  `;
  const params = [];
  let idx = 1;

  if (department) {
    query += ` AND template_department = $${idx}`;
    params.push(department);
    idx++;
  }

  query += ' ORDER BY mrn';
  const result = await pool.query(query, params);
  return result.rows.filter(row => row.mrn);
}
