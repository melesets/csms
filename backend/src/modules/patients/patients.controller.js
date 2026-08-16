// Patients controller - serves patient list and detail endpoints
// Transforms raw form data into standardized patient objects

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as patientsService from './patients.service.js';

export const getPatients = asyncHandler(async (req, res) => {
  const patients = await patientsService.findAllPatients(req.query.department);
  res.json(patients);
});

export const getPatientByMrn = asyncHandler(async (req, res) => {
  const patient = await patientsService.findPatientByMrn(req.params.mrn, req.query.department);
  if (!patient) return res.status(404).json({ error: 'No patient data found for this MRN' });

  const fd = patient.form_data;
  const findVal = (variations) => {
    for (const v of variations) {
      if (fd[v] !== undefined && fd[v] !== null && fd[v] !== '') return fd[v];
    }
    return '';
  };

  res.json({
    patientName: findVal(['Patient Name', 'patientName', 'Patient name', 'patient_name', 'PatientName', 'name', 'Name', 'Full Name', 'fullName', 'patient', 'Patient', 'Client Name', 'clientName', 'Client name']),
    mrn: findVal(['MRN', 'mrn', 'patient_mrn', 'patientMrn', '_mrn', 'Patient MRN', 'Medical Record Number']),
    age: findVal(['Age', 'age', 'AGE', 'Patient Age', 'patientAge']),
    gender: findVal(['Gender', 'gender', 'GENDER', 'sex', 'Sex', 'SEX']),
    bedNumber: findVal(['BN', 'bedNumber', 'Bed Number', 'bed_number', 'bn', 'Bed', 'bed', 'Bed No', 'bedNo', 'BedNo', 'bed_no', 'room', 'Room', 'roomNumber']),
    dateOfBirth: findVal(['dateOfBirth', 'Date of Birth', 'dob', 'DOB', 'birthDate', 'Birth Date']),
    allergies: findVal(['allergies', 'Allergies', 'ALLERGIES', 'allergy', 'Allergy']),
    diagnosis: findVal(['diagnosis', 'Diagnosis', 'Current Diagnosis', 'currentDiagnosis', 'Primary Diagnosis', 'primaryDiagnosis', 'condition', 'Condition']),
    lastUpdated: patient.submitted_at,
    lastUpdatedBy: patient.submitted_by_name,
    source: patient.template_name,
  });
});

export const getMrns = asyncHandler(async (req, res) => {
  const mrns = await patientsService.findMrns(req.query.department);
  res.json(mrns);
});
