// Core TypeScript types - Patient, Staff, Resource, ISBARRecord interfaces
export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bedNumber: string;
  triageCategory: 'Resuscitation' | 'Emergency' | 'Urgent' | 'Semi-urgent' | 'Non-urgent';
  oxygenation: {
    spO2: number;
    flowRateLpm: number;
    deliverySystem: string;
  };
  ventilation: {
    etCO2: number;
    respiratoryRate: number;
  };
  circulation: {
    heartRate: number;
    bloodPressure: string;
    temperature: number;
  };
  disability: {
    gcs: number;
    pupilResponse: string;
    bloodGlucose: number;
  };
  exposure: {
    injuries: string[];
    allergies: string[];
  };
  fullISBAR: {
    identity: string;
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
}


export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  employeeId: string;
  hireDate: string;
  shift: 'Day' | 'Evening' | 'Night';
  createdBy?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'Drug' | 'Equipment';
  department: string;
  quantity: number;
  unit: string;
  expiryDate?: string;
  location: string;
  lastUpdated: string;
  last_updated_by?: string;
  last_updated_by_name?: string;
  standard_quantity?: number;
  expiry_date?: string;
  batch_number?: string;
}

export interface ISBARRecord {
  id: string;
  patientName: string;
  age: number;
  mrn: string;
  bedNumber: string;
  nurseName: string;
  shift: 'Day' | 'Evening' | 'Night';
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  department: string;
  timestamp: string;
  vitalSigns: {
    temperature: number;
    heartRate: number;
    bloodPressure: string;
    respiratoryRate: number;
    oxygenSaturation: number;
  };
  submitted_by?: string;
  submitted_by_name?: string;
}