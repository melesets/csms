// Clinical measurement parameter library - shared by the vital-signs group field
// and standalone measurement fields in the form builder
export interface ClinicalParameter {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'bp' | 'text';
  min?: number;
  max?: number;
  precision?: number;
  category: 'vital' | 'anthropometric' | 'fluid' | 'neuro' | 'lab';
}

export const CLINICAL_PARAMETERS: ClinicalParameter[] = [
  // Vital signs
  { key: 'temperature', label: 'Temperature', unit: '°C', type: 'number', min: 30, max: 45, precision: 1, category: 'vital' },
  { key: 'bloodPressure', label: 'Blood Pressure', unit: 'mmHg', type: 'bp', min: 30, max: 300, category: 'vital' },
  { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', type: 'number', min: 20, max: 220, category: 'vital' },
  { key: 'pulseRate', label: 'Pulse Rate', unit: 'bpm', type: 'number', min: 20, max: 220, category: 'vital' },
  { key: 'respiratoryRate', label: 'Respiratory Rate', unit: 'breaths/min', type: 'number', min: 4, max: 80, category: 'vital' },
  { key: 'oxygenSaturation', label: 'O2 Saturation', unit: '%', type: 'number', min: 50, max: 100, category: 'vital' },
  { key: 'capillaryRefill', label: 'Capillary Refill', unit: 'sec', type: 'number', min: 0, max: 10, precision: 1, category: 'vital' },
  { key: 'painScore', label: 'Pain Score', unit: '/10', type: 'number', min: 0, max: 10, category: 'neuro' },
  { key: 'gcs', label: 'Glasgow Coma Scale', unit: '/15', type: 'number', min: 3, max: 15, category: 'neuro' },
  // Anthropometric
  { key: 'height', label: 'Height', unit: 'cm', type: 'number', min: 30, max: 250, precision: 1, category: 'anthropometric' },
  { key: 'weight', label: 'Weight', unit: 'kg', type: 'number', min: 0.5, max: 300, precision: 1, category: 'anthropometric' },
  { key: 'headCircumference', label: 'Head Circumference', unit: 'cm', type: 'number', min: 20, max: 60, precision: 1, category: 'anthropometric' },
  { key: 'muac', label: 'MUAC', unit: 'cm', type: 'number', min: 5, max: 40, precision: 1, category: 'anthropometric' },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²', type: 'number', min: 5, max: 80, precision: 1, category: 'anthropometric' },
  // Fluid / lab
  { key: 'urineOutput', label: 'Urine Output', unit: 'mL', type: 'number', min: 0, max: 5000, category: 'fluid' },
  { key: 'bloodGlucose', label: 'Blood Glucose', unit: 'mg/dL', type: 'number', min: 10, max: 600, category: 'lab' },
];

export const CLINICAL_PARAMETER_CATEGORIES: Array<{ id: ClinicalParameter['category']; name: string }> = [
  { id: 'vital', name: 'Vital Signs' },
  { id: 'anthropometric', name: 'Anthropometric' },
  { id: 'fluid', name: 'Fluid Balance' },
  { id: 'neuro', name: 'Neurological' },
  { id: 'lab', name: 'Laboratory' },
];