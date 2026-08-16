// Form builder types - FormField, FormTemplate, Section interfaces
export type TextAlign = 'left' | 'center' | 'right';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string; concept?: CodedValue }>;
  validation?: FieldValidation;
  conditional?: ConditionalLogic;
  skipLogic?: SkipLogic;        // New: controls field visibility
  calculation?: CalculatedField; // New: for calculated fields
  readonly?: boolean;            // New: prevent manual editing (e.g., for calculated fields)
  terminology?: TerminologyConfig; // New: for clinical coding (ICD-11, LOINC, etc.)
  width?: 'full' | 'half' | 'third' | 'quarter';
  selectionMode?: 'multiple' | 'single';  // checkbox: allow multiple or single selection
  optionsLayout?: 'vertical' | 'horizontal'; // checkbox: option stack direction
  section?: string;
  color?: string;
  align?: TextAlign;
  rows?: number;
  min?: number;
  max?: number;
  fields?: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
    min?: number;
    max?: number;
    options?: Array<{ value: string; label: string }>;
    unit?: string;
    precision?: number;
    mode?: 'bp';
  }>;
  unit?: string;
  precision?: number;
  mode?: 'bp';
  acceptedTypes?: string[];
  maxSize?: number;
  style?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  // Legacy single department; kept for backward compatibility with existing UI/CSV
  department: string;
  // New: support assigning a template to multiple departments
  departments?: string[];
  profession?: string | null;
  description: string;
  version: number;
  isActive: boolean;
  /** True = requires a staff reporter (Report page); false = general survey (Survey page) */
  requiresReporter: boolean;
  fields: FormField[];
  sections: FormSection[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormSection {
  id: string;
  name: string;
  description?: string;
  order: number;
  isCollapsible: boolean;
  isCollapsed: boolean;
  color?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  errorMessage?: string;
}

export interface ConditionalLogic {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
}

// Skip Logic - Controls field visibility based on conditions
export interface SkipLogic {
  action: 'show' | 'hide';      // What to do when conditions are met
  operator: 'AND' | 'OR';       // How to combine multiple conditions
  conditions: SkipCondition[];
}

export interface SkipCondition {
  field: string;                // Field name to check
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
  'greater_than' | 'less_than' | 'greater_or_equal' |
  'less_or_equal' | 'is_empty' | 'is_not_empty' | 'in_list';
  value: any;                   // Value to compare against
  compareToField?: string;      // Optional: compare to another field instead
}

// Calculated Fields - Auto-compute values using formulas
export interface CalculatedField {
  formula: string;              // JavaScript expression
  dependencies: string[];       // Field names this calculation depends on
  resultType: 'number' | 'text' | 'boolean';
  roundTo?: number;             // For numeric results

  errorValue?: any;             // Fallback value if calculation fails
}

// Terminology / Structured Data Types
export interface CodedValue {
  system: string;  // e.g., "http://hl7.org/fhir/sid/icd-11" or "http://loinc.org"
  code: string;    // e.g., "RA01"
  display: string; // e.g., "COVID-19"
  version?: string;
  category?: string; // e.g., "Vital Signs", "Labs", "NICU"
  datatype?: string; // e.g., "number", "text", "boolean", "coded-text"
  units?: string;    // e.g., "mmHg", "/min"
}

export interface QuantityValue extends CodedValue {
  value: number;
  unit: string;       // e.g., "mg/dL"
  unitSystem: string; // "http://unitsofmeasure.org" (UCUM)
  unitCode: string;   // UCUM code, e.g., "mg/dL"
}

export interface TerminologyConfig {
  system: 'ICD-11' | 'LOINC' | 'SNOMED-CT' | 'UCUM' | 'Custom' | 'All';
  subset?: string;         // e.g., "Problem List", "Vital Signs"
  allowMultiple?: boolean; // For multi-select concepts (e.g., multiple symptoms)
  displayMode?: 'code-first' | 'display-first';
}

export type FieldType =
  | 'text'
  | 'coded-text' // New: for structured clinical data
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'date'
  | 'time'
  | 'datetime'
  | 'vital-signs'
  | 'patient-info'
  | 'medication'
  | 'situation'
  | 'background'
  | 'assessment'
  | 'recommendation'
  | 'stability'
  | 'file-upload'
  | 'signature'
  | 'rating'
  | 'measurement'
  | 'divider';

export interface FieldTemplate {
  type: FieldType;
  label: string;
  icon: string;
  category: 'basic' | 'medical' | 'isbar' | 'advanced' | 'clinical' | 'patient';
  defaultProps: Partial<FormField>;
}