export interface ISBARRecord {
  id: string;
  patientName: string;
  age: number;
  mrn: string;
  bedNumber: string;
  department: string;
  nurseName: string;
  shift: 'Day' | 'Evening' | 'Night';
  timestamp: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  vitalSigns: {
    temperature: number;
    heartRate: number;
    bloodPressure: string;
    respiratoryRate: number;
    oxygenSaturation: number;
  };
  stability: 'Stable' | 'Unstable' | 'Critical';
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  employeeId: string;
  hireDate: string;
  shift: 'Day' | 'Evening' | 'Night';
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
  // Backend/DB fields for compatibility
  standard_quantity?: number;
  expiry_date?: string;
  batch_number?: string;
}