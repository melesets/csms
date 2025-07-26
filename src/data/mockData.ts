import { ISBARRecord, Staff, Resource } from '../types';
import { FormTemplate } from '../types/formBuilder';

export const mockISBARRecords: ISBARRecord[] = [
  {
    id: '1',
    patientName: 'John Smith',
    age: 45,
    mrn: 'MRN001',
    bedNumber: 'ICU-101',
    department: 'ICU',
    nurseName: 'Sarah Johnson',
    shift: 'Day',
    timestamp: new Date().toISOString(),
    situation: 'Patient admitted with chest pain',
    background: 'History of hypertension and diabetes',
    assessment: 'Stable vitals, pain controlled',
    recommendation: 'Continue monitoring, discharge planning',
    vitalSigns: {
      temperature: 37.2,
      heartRate: 82,
      bloodPressure: '140/90',
      respiratoryRate: 18,
      oxygenSaturation: 98
    },
    stability: 'Critical'
  },
  {
    id: '2',
    patientName: 'Maria Garcia',
    age: 28,
    mrn: 'MRN002',
    bedNumber: 'NICU-205',
    department: 'NICU',
    nurseName: 'Michael Davis',
    shift: 'Evening',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    situation: 'Preterm infant with respiratory distress',
    background: 'Born at 32 weeks, PROM',
    assessment: 'On CPAP, vitals improving',
    recommendation: 'Continue respiratory support, monitor closely',
    vitalSigns: {
      temperature: 36.8,
      heartRate: 145,
      bloodPressure: '65/40',
      respiratoryRate: 45,
      oxygenSaturation: 94
    },
    stability: 'Unstable'
  },
  {
    id: '3',
    patientName: 'Robert Wilson',
    age: 67,
    mrn: 'MRN003',
    bedNumber: 'Surgery-302',
    department: 'Surgery',
    nurseName: 'Sarah Johnson',
    shift: 'Day',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    situation: 'Post-operative day 1 after appendectomy',
    background: 'Acute appendicitis, no complications',
    assessment: 'Pain well controlled, ambulating',
    recommendation: 'Continue pain management, discharge planning',
    vitalSigns: {
      temperature: 37.0,
      heartRate: 78,
      bloodPressure: '130/85',
      respiratoryRate: 16,
      oxygenSaturation: 99
    },
    stability: 'Stable'
  }
];

export const mockStaff: Staff[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Registered Nurse',
    department: 'ICU',
    employeeId: 'EMP001',
    hireDate: '2022-01-15',
    shift: 'Day'
  },
  {
    id: '2',
    name: 'Michael Davis',
    role: 'Charge Nurse',
    department: 'NICU',
    employeeId: 'EMP002',
    hireDate: '2021-03-20',
    shift: 'Evening'
  }
];

export const mockResources: Resource[] = [
  {
    id: '1',
    name: 'Morphine',
    type: 'Drug',
    department: 'ICU',
    quantity: 50,
    unit: 'vials',
    expiryDate: '2024-12-31',
    location: 'Medication Room A',
    lastUpdated: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Ventilator',
    type: 'Equipment',
    department: 'ICU',
    quantity: 5,
    unit: 'units',
    location: 'Equipment Storage',
    lastUpdated: new Date().toISOString()
  }
];

export const mockFormTemplates: FormTemplate[] = [
  {
    id: '1',
    name: 'NICU Standard Handover',
    department: 'NICU',
    description: 'Standard ISBAR form for NICU patients',
    version: 1,
    isActive: true,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'patient-info',
        name: 'Patient Information',
        description: 'Basic patient details',
        order: 1,
        isCollapsible: false,
        isCollapsed: false
      },
      {
        id: 'vitals',
        name: 'Vital Signs',
        description: 'Current vital signs',
        order: 2,
        isCollapsible: true,
        isCollapsed: false
      },
      {
        id: 'isbar',
        name: 'ISBAR Assessment',
        description: 'ISBAR clinical assessment',
        order: 3,
        isCollapsible: false,
        isCollapsed: false
      }
    ],
    fields: [
      {
        id: 'patient-name',
        type: 'text',
        label: 'Patient Name',
        name: 'patientName',
        required: true,
        width: 'half',
        section: 'patient-info'
      },
      {
        id: 'age',
        type: 'number',
        label: 'Age (days)',
        name: 'age',
        required: true,
        width: 'quarter',
        section: 'patient-info',
        validation: { min: 0, max: 365 }
      },
      {
        id: 'temperature',
        type: 'temperature',
        label: 'Temperature (°C)',
        name: 'temperature',
        required: true,
        width: 'quarter',
        section: 'vitals',
        validation: { min: 35, max: 40 }
      },
      {
        id: 'heart-rate',
        type: 'heart-rate',
        label: 'Heart Rate (bpm)',
        name: 'heartRate',
        required: true,
        width: 'quarter',
        section: 'vitals',
        validation: { min: 100, max: 180 }
      },
      {
        id: 'situation',
        type: 'isbar-situation',
        label: 'Situation',
        name: 'situation',
        required: true,
        width: 'full',
        section: 'isbar',
        placeholder: 'Current patient situation...'
      }
    ]
  }
];