import { FieldTemplate } from '../types/formBuilder';

export const fieldTemplates: FieldTemplate[] = [
  // Basic Fields
  {
    type: 'text',
    label: 'Text Input',
    icon: 'Type',
    category: 'basic',
    defaultProps: {
      type: 'text',
      label: 'Text Field',
      name: 'text_field',
      required: false,
      width: 'full',
      placeholder: 'Enter text...'
    }
  },
  {
    type: 'number',
    label: 'Number Input',
    icon: 'Hash',
    category: 'basic',
    defaultProps: {
      type: 'number',
      label: 'Number Field',
      name: 'number_field',
      required: false,
      width: 'half'
    }
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    icon: 'ChevronDown',
    category: 'basic',
    defaultProps: {
      type: 'dropdown',
      label: 'Dropdown Field',
      name: 'dropdown_field',
      required: false,
      width: 'half',
      options: ['Option 1', 'Option 2', 'Option 3']
    }
  },
  {
    type: 'multiselect',
    label: 'Multi Select',
    icon: 'List',
    category: 'basic',
    defaultProps: {
      type: 'multiselect',
      label: 'Multi Select Field',
      name: 'multiselect_field',
      required: false,
      width: 'full',
      options: ['Option 1', 'Option 2', 'Option 3']
    }
  },
  {
    type: 'textarea',
    label: 'Text Area',
    icon: 'AlignLeft',
    category: 'basic',
    defaultProps: {
      type: 'textarea',
      label: 'Text Area',
      name: 'textarea_field',
      required: false,
      width: 'full',
      placeholder: 'Enter detailed information...'
    }
  },
  {
    type: 'date',
    label: 'Date Picker',
    icon: 'Calendar',
    category: 'basic',
    defaultProps: {
      type: 'date',
      label: 'Date Field',
      name: 'date_field',
      required: false,
      width: 'half'
    }
  },
  {
    type: 'time',
    label: 'Time Picker',
    icon: 'Clock',
    category: 'basic',
    defaultProps: {
      type: 'time',
      label: 'Time Field',
      name: 'time_field',
      required: false,
      width: 'half'
    }
  },

  // Medical Fields
  {
    type: 'temperature',
    label: 'Temperature',
    icon: 'Thermometer',
    category: 'medical',
    defaultProps: {
      type: 'temperature',
      label: 'Temperature (°C)',
      name: 'temperature',
      required: false,
      width: 'quarter',
      validation: { min: 30, max: 45 }
    }
  },
  {
    type: 'heart-rate',
    label: 'Heart Rate',
    icon: 'Heart',
    category: 'medical',
    defaultProps: {
      type: 'heart-rate',
      label: 'Heart Rate (bpm)',
      name: 'heart_rate',
      required: false,
      width: 'quarter',
      validation: { min: 40, max: 200 }
    }
  },
  {
    type: 'blood-pressure',
    label: 'Blood Pressure',
    icon: 'Activity',
    category: 'medical',
    defaultProps: {
      type: 'blood-pressure',
      label: 'Blood Pressure',
      name: 'blood_pressure',
      required: false,
      width: 'quarter',
      placeholder: '120/80'
    }
  },
  {
    type: 'o2-saturation',
    label: 'O2 Saturation',
    icon: 'Wind',
    category: 'medical',
    defaultProps: {
      type: 'o2-saturation',
      label: 'O2 Saturation (%)',
      name: 'o2_saturation',
      required: false,
      width: 'quarter',
      validation: { min: 70, max: 100 }
    }
  },
  {
    type: 'pain-scale',
    label: 'Pain Scale',
    icon: 'Zap',
    category: 'medical',
    defaultProps: {
      type: 'pain-scale',
      label: 'Pain Scale (0-10)',
      name: 'pain_scale',
      required: false,
      width: 'quarter',
      validation: { min: 0, max: 10 }
    }
  },

  // ISBAR Fields
  {
    type: 'isbar-situation',
    label: 'ISBAR: Situation',
    icon: 'AlertCircle',
    category: 'isbar',
    defaultProps: {
      type: 'isbar-situation',
      label: 'Situation',
      name: 'situation',
      required: true,
      width: 'full',
      placeholder: 'Current patient situation...'
    }
  },
  {
    type: 'isbar-background',
    label: 'ISBAR: Background',
    icon: 'FileText',
    category: 'isbar',
    defaultProps: {
      type: 'isbar-background',
      label: 'Background',
      name: 'background',
      required: true,
      width: 'full',
      placeholder: 'Patient background and history...'
    }
  },
  {
    type: 'isbar-assessment',
    label: 'ISBAR: Assessment',
    icon: 'CheckSquare',
    category: 'isbar',
    defaultProps: {
      type: 'isbar-assessment',
      label: 'Assessment',
      name: 'assessment',
      required: true,
      width: 'full',
      placeholder: 'Clinical assessment...'
    }
  },
  {
    type: 'isbar-recommendation',
    label: 'ISBAR: Recommendation',
    icon: 'Target',
    category: 'isbar',
    defaultProps: {
      type: 'isbar-recommendation',
      label: 'Recommendation',
      name: 'recommendation',
      required: true,
      width: 'full',
      placeholder: 'Recommendations and next steps...'
    }
  },

  // Advanced Fields
  {
    type: 'range',
    label: 'Range Slider',
    icon: 'MoreHorizontal',
    category: 'advanced',
    defaultProps: {
      type: 'range',
      label: 'Range Field',
      name: 'range_field',
      required: false,
      width: 'half',
      validation: { min: 0, max: 100 }
    }
  },
  {
    type: 'file',
    label: 'File Upload',
    icon: 'Upload',
    category: 'advanced',
    defaultProps: {
      type: 'file',
      label: 'File Upload',
      name: 'file_field',
      required: false,
      width: 'half'
    }
  },
  {
    type: 'divider',
    label: 'Section Divider',
    icon: 'Minus',
    category: 'advanced',
    defaultProps: {
      type: 'divider',
      label: 'Section Divider',
      name: 'divider',
      required: false,
      width: 'full'
    }
  }
];