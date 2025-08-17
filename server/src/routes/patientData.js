import express from 'express';
import { Pool } from 'pg';
const router = express.Router();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// GET: Fetch patient data by MRN
router.get('/mrn/:mrn', async (req, res) => {
  const { mrn } = req.params;
  const { department } = req.query;
  
  try {
    let query = `
      SELECT 
        form_data,
        template_name,
        template_department,
        submitted_at,
        submitted_by_name
      FROM form_submissions 
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // Add MRN search conditions - check multiple possible field names
    query += ` AND (
      form_data->>'mrn' = $${idx} OR 
      form_data->>'MRN' = $${idx} OR 
      form_data->>'patient_mrn' = $${idx} OR 
      form_data->>'patientMrn' = $${idx} OR
      form_data->>'_mrn' = $${idx}
    )`;
    params.push(mrn);
    idx++;

    // Filter by department if provided
    if (department) {
      query += ` AND template_department = $${idx}`;
      params.push(department);
      idx++;
    }

    // Order by most recent first
    query += ' ORDER BY submitted_at DESC LIMIT 1';

    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No patient data found for this MRN' });
    }

    // Extract patient identification data from the most recent submission
    const latestSubmission = result.rows[0];
    const formData = latestSubmission.form_data;
    
    // Log the form data for debugging
    console.log('Form data for MRN', mrn, ':', JSON.stringify(formData, null, 2));
    console.log('Available form fields:', Object.keys(formData));
    
    // Helper function to find field value by trying multiple variations
    const findFieldValue = (variations) => {
      for (const variation of variations) {
        if (formData[variation] !== undefined && formData[variation] !== null && formData[variation] !== '') {
          console.log(`Found value for field variations [${variations.join(', ')}]: ${variation} = ${formData[variation]}`);
          return formData[variation];
        }
      }
      console.log(`No value found for field variations: [${variations.join(', ')}]`);
      return '';
    };
    
    // Extract common identification fields with more variations
    const patientData = {
      // Patient identification - try multiple field name variations
      patientName: findFieldValue([
        'Patient Name', 'patientName', 'Patient name', 'patient_name', 'PatientName', 
        'name', 'Name', 'Full Name', 'fullName', 'patient', 'Patient'
      ]),
      
      mrn: findFieldValue([
        'MRN', 'mrn', 'patient_mrn', 'patientMrn', '_mrn', 'Patient MRN', 'Medical Record Number'
      ]),
      
      age: findFieldValue([
        'Age', 'age', 'AGE', 'Patient Age', 'patientAge'
      ]),
      
      gender: findFieldValue([
        'Gender', 'gender', 'GENDER', 'sex', 'Sex', 'SEX'
      ]),
      
      bedNumber: findFieldValue([
        'BN', 'bedNumber', 'Bed Number', 'bed_number', 'bn', 'Bed', 'bed', 
        'Bed No', 'bedNo', 'BedNo', 'bed_no', 'room', 'Room', 'roomNumber'
      ]),
      
      // Additional common fields that might be useful
      dateOfBirth: findFieldValue([
        'dateOfBirth', 'Date of Birth', 'dob', 'DOB', 'birthDate', 'Birth Date'
      ]),
      
      allergies: findFieldValue([
        'allergies', 'Allergies', 'ALLERGIES', 'allergy', 'Allergy'
      ]),
      
      diagnosis: findFieldValue([
        'diagnosis', 'Diagnosis', 'Current Diagnosis', 'currentDiagnosis', 
        'Primary Diagnosis', 'primaryDiagnosis', 'condition', 'Condition'
      ]),
      
      // Metadata
      lastUpdated: latestSubmission.submitted_at,
      lastUpdatedBy: latestSubmission.submitted_by_name,
      source: latestSubmission.template_name
    };

    console.log('Extracted patient data:', JSON.stringify(patientData, null, 2));

    res.json(patientData);
  } catch (err) {
    console.error('Error fetching patient data:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Get all unique MRNs in a department (for autocomplete/validation)
router.get('/mrns', async (req, res) => {
  const { department } = req.query;
  
  try {
    let query = `
      SELECT DISTINCT 
        COALESCE(
          form_data->>'mrn',
          form_data->>'MRN', 
          form_data->>'patient_mrn',
          form_data->>'patientMrn',
          form_data->>'_mrn'
        ) as mrn,
        COALESCE(
          form_data->>'patientName',
          form_data->>'Patient name',
          form_data->>'patient_name'
        ) as patient_name
      FROM form_submissions 
      WHERE COALESCE(
        form_data->>'mrn',
        form_data->>'MRN', 
        form_data->>'patient_mrn',
        form_data->>'patientMrn',
        form_data->>'_mrn'
      ) IS NOT NULL
      AND COALESCE(
        form_data->>'mrn',
        form_data->>'MRN', 
        form_data->>'patient_mrn',
        form_data->>'patientMrn',
        form_data->>'_mrn'
      ) != ''
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
    res.json(result.rows.filter(row => row.mrn)); // Filter out any null results
  } catch (err) {
    console.error('Error fetching MRNs:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;