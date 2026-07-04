// Field template definitions - reusable form field configurations
export const fieldTemplates = [
  // Basic Fields
  {
    type: 'text',
    label: 'Text Input',
    category: 'basic',
    icon: 'Type',
    defaultProps: {
      label: 'Text Field',
      placeholder: 'Enter text...',
      required: false,
      validation: {}
    }
  },
  {
    type: 'textarea',
    label: 'Text Area',
    category: 'basic',
    icon: 'AlignLeft',
    defaultProps: {
      label: 'Text Area',
      placeholder: 'Enter detailed text...',
      required: false,
      rows: 3,
      validation: {}
    }
  },
  {
    type: 'number',
    label: 'Number Input',
    category: 'basic',
    icon: 'Hash',
    defaultProps: {
      label: 'Number Field',
      placeholder: 'Enter number...',
      required: false,
      min: 0,
      max: 1000,
      validation: {}
    }
  },
  {
    type: 'select',
    label: 'Dropdown',
    category: 'basic',
    icon: 'ChevronDown',
    defaultProps: {
      label: 'Select Option',
      placeholder: 'Choose an option...',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ],
      validation: {}
    }
  },
  {
    type: 'multiselect',
    label: 'Multi-Select Dropdown',
    category: 'basic',
    icon: 'List',
    defaultProps: {
      label: 'Select Multiple Options',
      placeholder: 'Choose multiple options...',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' },
        { value: 'option4', label: 'Option 4' }
      ],
      validation: {}
    }
  },
  {
    type: 'radio',
    label: 'Radio Buttons',
    category: 'basic',
    icon: 'Circle',
    defaultProps: {
      label: 'Choose One',
      required: false,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ],
      validation: {}
    }
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    category: 'basic',
    icon: 'CheckSquare',
    defaultProps: {
      label: 'Select Multiple',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' }
      ],
      validation: {}
    }
  },
  {
    type: 'date',
    label: 'Date Picker',
    category: 'basic',
    icon: 'Calendar',
    defaultProps: {
      label: 'Date',
      required: false,
      validation: {}
    }
  },
  {
    type: 'time',
    label: 'Time Picker',
    category: 'basic',
    icon: 'Clock',
    defaultProps: {
      label: 'Time',
      required: false,
      validation: {}
    }
  },

  // Medical Fields
  {
    type: 'vital-signs',
    label: 'Vital Signs',
    category: 'medical',
    icon: 'Activity',
    defaultProps: {
      label: 'Vital Signs',
      required: false,
      fields: [
        { name: 'temperature', label: 'Temperature (°C)', type: 'number', min: 30, max: 45 },
        { name: 'heartRate', label: 'Heart Rate (bpm)', type: 'number', min: 30, max: 200 },
        { name: 'bloodPressure', label: 'Blood Pressure', type: 'text', placeholder: '120/80' },
        { name: 'respiratoryRate', label: 'Respiratory Rate', type: 'number', min: 5, max: 60 },
        { name: 'oxygenSaturation', label: 'O2 Saturation (%)', type: 'number', min: 70, max: 100 }
      ],
      validation: {}
    }
  },
  {
    type: 'patient-info',
    label: 'Patient Information',
    category: 'medical',
    icon: 'User',
    defaultProps: {
      label: 'Patient Information',
      required: false,
      fields: [
        { name: 'patientName', label: 'Patient Name', type: 'text', required: true },
        { name: 'mrn', label: 'MRN', type: 'text', required: true },
        { name: 'age', label: 'Age', type: 'number', min: 0, max: 120 },
        { name: 'bedNumber', label: 'Bed Number', type: 'text' },
        { name: 'department', label: 'Department', type: 'text' }
      ],
      validation: {}
    }
  },
  {
    type: 'medication',
    label: 'Medication',
    category: 'medical',
    icon: 'Pill',
    defaultProps: {
      label: 'Medication',
      required: false,
      fields: [
        { name: 'medicationName', label: 'Medication Name', type: 'text' },
        { name: 'dosage', label: 'Dosage', type: 'text' },
        { name: 'frequency', label: 'Frequency', type: 'text' },
        {
          name: 'route', label: 'Route', type: 'select', options: [
            { value: 'oral', label: 'Oral' },
            { value: 'iv', label: 'IV' },
            { value: 'im', label: 'IM' },
            { value: 'topical', label: 'Topical' }
          ]
        }
      ],
      validation: {}
    }
  },

  {
    type: 'coded-text',
    label: 'Clinical Concept',
    category: 'medical',
    icon: 'Database',
    defaultProps: {
      label: 'Diagnosis / Problem',
      placeholder: 'Search clinical terms...',
      required: false,
      validation: {},
      terminology: {
        system: 'ICD-11',
        allowMultiple: false
      }
    }
  },
  {
    type: 'coded-text',
    label: 'Nursing Intervention',
    category: 'medical',
    icon: 'ClipboardList',
    defaultProps: {
      label: 'Nursing Intervention',
      placeholder: 'Search nursing terms...',
      required: false,
      validation: {},
      terminology: {
        system: 'Nursing',
        allowMultiple: true,
        subset: 'Nursing'
      }
    }
  },
  {
    type: 'coded-text',
    label: 'Vital Sign (Coded)',
    category: 'medical',
    icon: 'Activity',
    defaultProps: {
      label: 'Vital Sign',
      placeholder: 'Search vitals (e.g. HR, BP)...',
      required: false,
      validation: {},
      terminology: {
        system: 'LOINC',
        subset: 'Vital Signs',
        allowMultiple: false
      }
    }
  },

  // ISBAR Fields
  {
    type: 'situation',
    label: 'Situation',
    category: 'isbar',
    icon: 'AlertCircle',
    defaultProps: {
      label: 'Situation',
      placeholder: 'Describe the current situation...',
      required: true,
      rows: 3,
      validation: {}
    }
  },
  {
    type: 'background',
    label: 'Background',
    category: 'isbar',
    icon: 'FileText',
    defaultProps: {
      label: 'Background',
      placeholder: 'Provide relevant background information...',
      required: true,
      rows: 3,
      validation: {}
    }
  },
  {
    type: 'assessment',
    label: 'Assessment',
    category: 'isbar',
    icon: 'Stethoscope',
    defaultProps: {
      label: 'Assessment',
      placeholder: 'Clinical assessment and findings...',
      required: true,
      rows: 3,
      validation: {}
    }
  },
  {
    type: 'recommendation',
    label: 'Recommendation',
    category: 'isbar',
    icon: 'Target',
    defaultProps: {
      label: 'Recommendation',
      placeholder: 'Recommendations and actions needed...',
      required: true,
      rows: 3,
      validation: {}
    }
  },
  {
    type: 'stability',
    label: 'Patient Stability',
    category: 'isbar',
    icon: 'TrendingUp',
    defaultProps: {
      label: 'Patient Stability',
      required: true,
      options: [
        { value: 'stable', label: 'Stable' },
        { value: 'subcritical', label: 'Sub-critical' },
        { value: 'critical', label: 'Critical' }
      ],
      validation: {}
    }
  },

  // Advanced Fields
  {
    type: 'file-upload',
    label: 'File Upload',
    category: 'advanced',
    icon: 'Upload',
    defaultProps: {
      label: 'Upload File',
      required: false,
      acceptedTypes: ['.pdf', '.jpg', '.png', '.doc', '.docx'],
      maxSize: 5, // MB
      validation: {}
    }
  },
  {
    type: 'signature',
    label: 'Digital Signature',
    category: 'advanced',
    icon: 'PenTool',
    defaultProps: {
      label: 'Digital Signature',
      required: false,
      validation: {}
    }
  },
  {
    type: 'rating',
    label: 'Rating Scale',
    category: 'advanced',
    icon: 'Star',
    defaultProps: {
      label: 'Rating',
      required: false,
      min: 1,
      max: 5,
      validation: {}
    }
  },
  {
    type: 'divider',
    label: 'Section Divider',
    category: 'advanced',
    icon: 'Minus',
    defaultProps: {
      label: 'Section Break',
      style: 'line', // line, space, heading
      validation: {}
    }
  }
];