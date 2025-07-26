export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: FieldValidation;
  conditional?: ConditionalLogic;
  width: 'full' | 'half' | 'third' | 'quarter';
  section?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  department: string;
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
  | 'dropdown' 
  | 'multiselect'
  | 'textarea'
  | 'date'
  | 'time'
  | 'datetime'
  | 'temperature'
  | 'heart-rate'
  | 'blood-pressure'
  | 'o2-saturation'
  | 'pain-scale'
  | 'isbar-situation'
  | 'isbar-background'
  | 'isbar-assessment'
  | 'isbar-recommendation'
  | 'range'
  | 'file'
  | 'divider';

export interface FieldTemplate {
  type: FieldType;
  label: string;
  icon: string;
  category: 'basic' | 'medical' | 'isbar' | 'advanced';
  defaultProps: Partial<FormField>;
}