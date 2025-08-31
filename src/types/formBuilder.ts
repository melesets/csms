export type TextAlign = 'left' | 'center' | 'right';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: FieldValidation;
  conditional?: ConditionalLogic;
  width?: 'full' | 'half' | 'third' | 'quarter';
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
  }>;
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

export type FieldType = 
  | 'text' 
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
  | 'divider';

export interface FieldTemplate {
  type: FieldType;
  label: string;
  icon: string;
  category: 'basic' | 'medical' | 'isbar' | 'advanced';
  defaultProps: Partial<FormField>;
}