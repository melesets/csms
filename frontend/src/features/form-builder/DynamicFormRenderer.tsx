// Dynamic form renderer - renders form templates with validation and conditional logic
import React, { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight, Search, Calculator } from 'lucide-react';
import { FormTemplate, FormField, SkipLogic } from '../../types/formBuilder';
import { ConceptPicker } from './ConceptPicker';
import { MinimalistMultiSelect } from './MinimalistMultiSelect';
import { EthiopianDateInput, Spinner } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';

// Color schemes for sections (same as SectionedFormCanvas)
const SECTION_COLORS = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-500', hover: 'hover:bg-blue-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', accent: 'bg-green-500', hover: 'hover:bg-green-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', accent: 'bg-purple-500', hover: 'hover:bg-purple-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', accent: 'bg-orange-500', hover: 'hover:bg-orange-100' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', accent: 'bg-pink-500', hover: 'hover:bg-pink-100' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', accent: 'bg-indigo-500', hover: 'hover:bg-indigo-100' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', accent: 'bg-teal-500', hover: 'hover:bg-teal-100' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', accent: 'bg-gray-500', hover: 'hover:bg-gray-100' },
};

interface DynamicFormRendererProps {
  template: FormTemplate;
  onSubmit: (data: Record<string, any>) => void;
  isPreview?: boolean;
  initialData?: Record<string, any>;
  onSuccess?: () => void;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  template,
  onSubmit,
  isPreview = false,
  initialData = {},
  onSuccess
}) => {
  const { user } = useAuth();
  
  const roleTitle = user?.profession || user?.role || 'Clinician';
  
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // State for section collapse/expand
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // State for field visibility (skip logic)
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({});

  // State for MRN auto-population
  const [mrnLookupLoading, setMrnLookupLoading] = useState(false);
  const [mrnLookupStatus, setMrnLookupStatus] = useState<string>('');

  // Safe access to template properties
  const templateSections = template.sections || [];
  const templateFields = template.fields || [];

  // Toggle section collapse/expand
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Normalize a string for name/label matching
  const norm = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Match a field by its name OR label (handles auto-generated timestamp suffixes)
  const fieldMatches = useCallback((field: FormField, names: string[]) => {
    const fn = norm(field.name);
    const fl = norm(field.label);
    return names.some(nm => {
      const t = norm(nm);
      return fn === t || fl === t || fn.startsWith(t);
    });
  }, []);

  // MRN lookup functionality
  const lookupPatientByMRN = useCallback(async (mrn: string) => {
    if (!mrn || mrn.length < 2) return;

    setMrnLookupLoading(true);
    setMrnLookupStatus('');

    try {
      const response = await fetch(`/api/patient-data/mrn/${encodeURIComponent(mrn)}?department=${encodeURIComponent(template.department || '')}`);

      if (response.ok) {
        const patientData = await response.json();

        // Auto-populate identification fields (matched by field name OR label)
        const populateSpecs: Array<{ names: string[]; value: any; isGender?: boolean }> = [
          { names: ['Patient Name', 'patientName', 'Patient name', 'patient_name', 'PatientName', 'name', 'Name', 'Client Name', 'clientName', 'Client name'], value: patientData.patientName },
          { names: ['MRN', 'mrn', 'patient_mrn', 'patientMrn', '_mrn'], value: patientData.mrn },
          { names: ['Age', 'age', 'AGE', 'Patient Age', 'patientAge'], value: patientData.age },
          { names: ['Gender', 'gender', 'GENDER', 'sex', 'Sex', 'SEX'], value: patientData.gender, isGender: true },
          { names: ['BN', 'bedNumber', 'Bed Number', 'bed_number', 'bn', 'Bed', 'bed', 'Bed No', 'bedNo', 'BedNo'], value: patientData.bedNumber },
          { names: ['dateOfBirth', 'Date of Birth', 'dob', 'DOB', 'birthDate', 'Birth Date'], value: patientData.dateOfBirth },
          { names: ['allergies', 'Allergies', 'ALLERGIES', 'allergy', 'Allergy'], value: patientData.allergies },
          { names: ['diagnosis', 'Diagnosis', 'Current Diagnosis', 'currentDiagnosis', 'Primary Diagnosis', 'primaryDiagnosis', 'condition', 'Condition'], value: patientData.diagnosis },
        ];

        // Only populate fields that exist in the form
        const updatedData: Record<string, any> = {};
        populateSpecs.forEach(({ names, value, isGender }) => {
          if (!value) return;
          const target = templateFields.find(field => fieldMatches(field, names));
          if (!target) return;

          const currentVal = formData[target.name];
          if (!currentVal || currentVal === '' || currentVal === 'N/A' || currentVal === 'Unknown') {
            let finalValue = value;
            if (isGender && (target.options || []).length > 0) {
              // Map stored gender text to the field's select options
              const optionValues = target.options || [];
              const sv = norm(String(value));
              const matched = optionValues.find(o => {
                const ov = norm(String((o as any).value));
                const ol = norm(String((o as any).label));
                return ov === sv || ol === sv
                  || (sv === 'm' && (ov === 'm' || ov === 'male' || ol === 'male'))
                  || (sv === 'f' && (ov === 'f' || ov === 'female' || ol === 'female'))
                  || (sv === '1' && ov === '1')
                  || (sv === '2' && ov === '2');
              });
              if (!matched) return; // Don't populate an unmatchable gender
              finalValue = (matched as any).value;
            }
            updatedData[target.name] = finalValue;
          }
        });

        if (Object.keys(updatedData).length > 0) {
          setFormData(prev => ({ ...prev, ...updatedData }));
          setMrnLookupStatus(`✓ Found patient: ${patientData.patientName || 'Record loaded'}. Auto-populated ${Object.keys(updatedData).length} fields.`);
        } else {
          setMrnLookupStatus('✓ Match found: Patient record is already up to date in this form.');
        }
      } else if (response.status === 404) {
        setMrnLookupStatus('No existing patient data found for this MRN');
      } else {
        setMrnLookupStatus('Error looking up patient data');
      }
    } catch (error) {
      console.error('MRN lookup error:', error);
      setMrnLookupStatus('Error connecting to patient database');
    } finally {
      setMrnLookupLoading(false);
    }
  }, [template.department, templateFields, fieldMatches]);

  // Debounced MRN lookup
  useEffect(() => {
    const mrnField = templateFields.find(field => fieldMatches(field, ['MRN', 'mrn', 'patient_mrn', 'patientMrn', '_mrn']));
    const currentMRN = mrnField ? (formData[mrnField.name] || '') : '';

    if (currentMRN && String(currentMRN).trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        lookupPatientByMRN(String(currentMRN));
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setMrnLookupStatus('');
    }
  }, [formData, templateFields, fieldMatches, lookupPatientByMRN]);

  // Skip Logic Evaluation Engine
  const evaluateSkipLogic = useCallback((field: FormField): boolean => {
    if (!field.skipLogic) return true; // No skip logic = always visible

    const { action, operator, conditions } = field.skipLogic;

    // No conditions = no logic applied
    if (!conditions || conditions.length === 0) return true;

    // Evaluate each condition
    const results = conditions.map(condition => {
      const fieldValue = formData[condition.field];
      const compareValue = condition.compareToField
        ? formData[condition.compareToField]
        : condition.value;

      // Implement operator logic
      switch (condition.operator) {
        case 'equals': {
          if (Array.isArray(fieldValue)) return fieldValue.some(v => v == compareValue);
          if (Array.isArray(compareValue)) return compareValue.some(v => v == fieldValue);
          return fieldValue == compareValue;
        }
        case 'not_equals': {
          if (Array.isArray(fieldValue)) return !fieldValue.some(v => v == compareValue);
          if (Array.isArray(compareValue)) return !compareValue.some(v => v == fieldValue);
          return fieldValue != compareValue;
        }
        case 'contains': {
          const haystack = Array.isArray(fieldValue) ? fieldValue.join(' ') : String(fieldValue || '');
          return haystack.includes(String(compareValue || ''));
        }
        case 'not_contains': {
          const haystack = Array.isArray(fieldValue) ? fieldValue.join(' ') : String(fieldValue || '');
          return !haystack.includes(String(compareValue || ''));
        }
        case 'greater_than':
          return Number(fieldValue) > Number(compareValue);
        case 'less_than':
          return Number(fieldValue) < Number(compareValue);
        case 'greater_or_equal':
          return Number(fieldValue) >= Number(compareValue);
        case 'less_or_equal':
          return Number(fieldValue) <= Number(compareValue);
        case 'is_empty':
          return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'is_not_empty':
          return !!fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
        case 'in_list': {
          const listValues = Array.isArray(compareValue) ? compareValue : String(compareValue).split(',').map(v => v.trim());
          if (Array.isArray(fieldValue)) return fieldValue.some(v => listValues.includes(String(v)));
          return listValues.includes(String(fieldValue));
        }
        default:
          return true;
      }
    });

    // Combine results with AND/OR
    const conditionsMet = operator === 'AND'
      ? results.every(r => r)
      : results.some(r => r);

    // Return visibility based on action
    return action === 'show' ? conditionsMet : !conditionsMet;
  }, [formData]);

  // Calculated Field Computation Engine
  const calculateFieldValue = useCallback((field: FormField): any => {
    if (!field.calculation) return undefined;

    try {
      const { formula, dependencies, resultType, roundTo, errorValue } = field.calculation;

      // Build context with field values
      const context: Record<string, any> = {};
      dependencies.forEach(dep => {
        context[dep] = formData[dep];
      });

      // Safe evaluation using Function constructor with limited scope
      // Replace field names in formula with safe variable names
      let safeFormula = formula;
      dependencies.forEach(dep => {
        const safeVarName = dep.replace(/[^a-zA-Z0-9_]/g, '_');
        const regex = new RegExp(`\\b${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        safeFormula = safeFormula.replace(regex, safeVarName);
        context[safeVarName] = context[dep];
      });

      // Create function with safe variable names
      const safeVarNames = dependencies.map(dep => dep.replace(/[^a-zA-Z0-9_]/g, '_'));
      const func = new Function(...safeVarNames, `return ${safeFormula}`);
      let result = func(...safeVarNames.map(varName => context[varName]));

      // Guard against NaN results (e.g. empty dependencies) - never store NaN
      if (typeof result === 'number' && isNaN(result)) {
        return field.calculation.errorValue !== undefined ? field.calculation.errorValue : undefined;
      }

      // Type conversion and rounding
      if (resultType === 'number') {
        result = Number(result);
        if (roundTo !== undefined && !isNaN(result)) {
          result = Math.round(result * Math.pow(10, roundTo)) / Math.pow(10, roundTo);
        }
      } else if (resultType === 'text') {
        result = String(result);
      } else if (resultType === 'boolean') {
        result = typeof result === 'string' ? result.toLowerCase() === 'true' : Boolean(result);
      }

      return result;
    } catch (error) {
      console.error(`Calculation error for field ${field.name}:`, error);
      return field.calculation.errorValue;
    }
  }, [formData]);

  // Update field visibility when form data changes
  useEffect(() => {
    const visibility: Record<string, boolean> = {};
    templateFields.forEach(field => {
      visibility[field.id] = evaluateSkipLogic(field);
    });
    setFieldVisibility(visibility);
  }, [formData, templateFields, evaluateSkipLogic]);

  // Auto-calculate fields when dependencies change
  useEffect(() => {
    const calculatedFields = templateFields.filter(f => f.calculation);

    calculatedFields.forEach(field => {
      const newValue = calculateFieldValue(field);
      if (newValue !== undefined && !Number.isNaN(newValue) && newValue !== formData[field.name]) {
        setFormData(prev => ({ ...prev, [field.name]: newValue }));
      }
    });
  }, [formData, templateFields, calculateFieldValue]);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));

    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required`;
    }

    if (field.validation) {
      const validation = field.validation;

      if (validation.min !== undefined && value < validation.min) {
        return validation.errorMessage || `${field.label} must be at least ${validation.min}`;
      }

      if (validation.max !== undefined && value > validation.max) {
        return validation.errorMessage || `${field.label} must be at most ${validation.max}`;
      }

      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        return validation.errorMessage || `${field.label} format is invalid`;
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreview) return;

    const newErrors: Record<string, string> = {};

    // Validate all visible, non-calculated fields
    templateFields.forEach(field => {
      if (field.type === 'divider') return; // Skip dividers
      if (field.calculation) return; // Skip calculated fields (readonly)
      if (!fieldVisibility[field.id]) return; // Skip hidden fields

      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const cleanData = { ...formData };
      onSubmit(cleanData);
      if (onSuccess) onSuccess();
    }
  };

  const renderField = (field: FormField) => {
    // Check field visibility (skip logic)
    if (!fieldVisibility[field.id]) {
      return null; // Don't render hidden fields
    }

    const value = formData[field.name] || '';
    const error = errors[field.name];
    const disabled = isPreview || field.readonly || !!field.calculation;
    const isCalculated = !!field.calculation;

    const getWidthClass = () => {
      switch (field.width) {
        case 'half': return 'md:w-1/2';
        case 'third': return 'md:w-1/3';
        case 'quarter': return 'md:w-1/4';
        default: return 'w-full';
      }
    };

    const baseInputClass = `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${error ? 'border-red-300' : 'border-gray-300'
      } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`;

    switch (field.type) {
      case 'text':
        // Check if this is an MRN field (matched by name or label)
        const isMrnField = fieldMatches(field, ['MRN', 'mrn', 'patient_mrn', 'patientMrn', '_mrn']);

        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
              {isCalculated && (
                <span className="ml-2 text-xs text-purple-600" title="This field is calculated automatically">
                  <Calculator className="w-3 h-3 inline mr-1" />
                  Auto-calculated
                </span>
              )}
              {isMrnField && (
                <span className="ml-2 text-xs text-blue-600">
                  <Search className="w-3 h-3 inline mr-1" />
                  Auto-populate
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={value}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={disabled}
                className={baseInputClass}
              />
              {isMrnField && mrnLookupLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            {isMrnField && mrnLookupStatus && (
              <p className={`text-xs mt-1 ${mrnLookupStatus.startsWith('✓')
                ? 'text-green-600'
                : mrnLookupStatus.includes('Error') || mrnLookupStatus.includes('No existing')
                  ? 'text-orange-600'
                  : 'text-gray-600'
                }`}>
                {mrnLookupStatus}
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleInputChange(field.name, parseFloat(e.target.value) || '')}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              disabled={disabled}
              className={baseInputClass}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'coded-text':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <ConceptPicker
              config={field.terminology || { system: 'ICD-11' }}
              value={value}
              onChange={(newValue) => handleInputChange(field.name, newValue)}
              placeholder={field.placeholder}
              disabled={disabled}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'textarea':
      case 'situation':
      case 'background':
      case 'assessment':
      case 'recommendation':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4 relative`}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            </div>
            
            <textarea
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 3}
              disabled={disabled}
              className={`${baseInputClass} resize-none`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              disabled={disabled}
              className={baseInputClass}
            >
              <option value="">{field.placeholder || 'Select an option'}</option>
              {(field.options || []).map((option, index) => {
                // Handle both string options and object options
                if (typeof option === 'string') {
                  return (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  );
                } else {
                  return (
                    <option key={index} value={option.value}>
                      {option.label}
                    </option>
                  );
                }
              })}
            </select>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <MinimalistMultiSelect
              options={field.options || []}
              value={value || []}
              onChange={(newValue) => handleInputChange(field.name, newValue)}
              disabled={disabled}
              placeholder={field.placeholder || 'Select options...'}
              className={error ? 'border-red-300' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'radio':
      case 'stability':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {(field.options || []).map((option, index) => {
                // Handle both string options and object options
                const optionValue = typeof option === 'string' ? option : option.value;
                const optionLabel = typeof option === 'string' ? option : option.label;
                return (
                  <label key={index} className="flex items-center">
                    <input
                      type="radio"
                      name={field.name}
                      value={optionValue}
                      checked={value === optionValue}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      disabled={disabled}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{optionLabel}</span>
                  </label>
                );
              })}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'checkbox': {
        const isSingleSelect = field.selectionMode === 'single';
        const isHorizontal = field.optionsLayout === 'horizontal';

        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className={isHorizontal ? 'flex flex-wrap gap-x-6 gap-y-2' : 'space-y-2'}>
              {(field.options || []).map((option, index) => {
                // Handle both string options and object options
                const optionValue = typeof option === 'string' ? option : option.value;
                const optionLabel = typeof option === 'string' ? option : option.label;
                const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
                const isChecked = isSingleSelect
                  ? (Array.isArray(value) ? value.includes(optionValue) : value === optionValue)
                  : currentValues.includes(optionValue);
                return (
                  <label key={index} className="flex items-center">
                    <input
                      type="checkbox"
                      value={optionValue}
                      checked={isChecked}
                      onChange={(e) => {
                        if (isSingleSelect) {
                          handleInputChange(field.name, e.target.checked ? optionValue : '');
                        } else {
                          if (e.target.checked) {
                            handleInputChange(field.name, [...currentValues, optionValue]);
                          } else {
                            handleInputChange(field.name, currentValues.filter((v: string) => v !== optionValue));
                          }
                        }
                      }}
                      disabled={disabled}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{optionLabel}</span>
                  </label>
                );
              })}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      }

      case 'date':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <EthiopianDateInput
              label={field.label}
              value={value}
              onChange={(gregorianDate) => handleInputChange(field.name, gregorianDate)}
              name={field.name}
              required={field.required}
              disabled={disabled}
              error={error}
            />
          </div>
        );

      case 'time':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="time"
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              disabled={disabled}
              className={baseInputClass}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'vital-signs':
        return (
          <div key={field.id} className="w-full px-2 mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg">
              {(field.fields || []).map((subField, index) => {
                const subValue = formData[subField.name] || '';
                const isBP = subField.mode === 'bp';
                const subStep = subField.precision !== undefined ? 1 / Math.pow(10, subField.precision) : 1;

                if (isBP) {
                  const [sys, dia] = String(subValue).split('/');
                  return (
                    <div key={index}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {subField.label}
                        {subField.required && <span className="text-red-500 ml-1">*</span>}
                        {subField.unit && <span className="ml-1 text-gray-400">{subField.unit}</span>}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={sys || ''}
                          onChange={(e) => handleInputChange(subField.name, `${e.target.value || ''}/${dia || ''}`)}
                          placeholder="Systolic"
                          min={subField.min}
                          max={subField.max}
                          disabled={disabled}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <span className="text-gray-400 text-sm">/</span>
                        <input
                          type="number"
                          value={dia || ''}
                          onChange={(e) => handleInputChange(subField.name, `${sys || ''}/${e.target.value || ''}`)}
                          placeholder="Diastolic"
                          min={subField.min}
                          max={subField.max}
                          disabled={disabled}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={index}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {subField.label}
                      {subField.required && <span className="text-red-500 ml-1">*</span>}
                      {subField.unit && <span className="ml-1 text-gray-400">{subField.unit}</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={subField.type}
                        value={subValue}
                        onChange={(e) => handleInputChange(subField.name, subField.type === 'number'
                          ? (e.target.value === '' ? '' : parseFloat(e.target.value))
                          : e.target.value)}
                        placeholder={subField.placeholder}
                        min={subField.min}
                        max={subField.max}
                        step={subStep}
                        disabled={disabled}
                        className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${subField.unit ? 'pr-12' : ''}`}
                      />
                      {subField.unit && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                          {subField.unit}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'measurement': {
        const isBP = field.mode === 'bp';
        const step = field.precision !== undefined ? 1 / Math.pow(10, field.precision) : 1;

        if (isBP) {
          const [sys, dia] = String(value).split('/');
          return (
            <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
                {field.unit && <span className="ml-1 text-xs text-gray-400">{field.unit}</span>}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={sys || ''}
                  onChange={(e) => handleInputChange(field.name, `${e.target.value || ''}/${dia || ''}`)}
                  placeholder="Systolic"
                  min={field.min}
                  max={field.max}
                  disabled={disabled}
                  className={baseInputClass}
                />
                <span className="text-gray-400">/</span>
                <input
                  type="number"
                  value={dia || ''}
                  onChange={(e) => handleInputChange(field.name, `${sys || ''}/${e.target.value || ''}`)}
                  placeholder="Diastolic"
                  min={field.min}
                  max={field.max}
                  disabled={disabled}
                  className={baseInputClass}
                />
              </div>
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
          );
        }

        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
              {field.unit && <span className="ml-1 text-xs text-gray-400">{field.unit}</span>}
            </label>
            <div className="relative">
              <input
                type="number"
                value={value}
                onChange={(e) => handleInputChange(field.name, e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                step={step}
                disabled={disabled}
                className={`${baseInputClass} ${field.unit ? 'pr-14' : ''}`}
              />
              {field.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                  {field.unit}
                </span>
              )}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      }

      case 'patient-info':
        return (
          <div key={field.id} className="w-full px-2 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg">
              {(field.fields || []).map((subField, index) => (
                <div key={index}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {subField.label}
                    {subField.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={subField.type}
                    value={formData[subField.name] || ''}
                    onChange={(e) => handleInputChange(subField.name, e.target.value)}
                    placeholder={subField.placeholder}
                    min={subField.min}
                    max={subField.max}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'rating':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}: {value || field.min || 1}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="range"
              value={value || field.min || 1}
              onChange={(e) => handleInputChange(field.name, parseInt(e.target.value))}
              min={field.min || 1}
              max={field.max || 5}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{field.min || 1}</span>
              <span>{field.max || 5}</span>
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'divider':
        return (
          <div key={field.id} className="w-full px-2 mb-6">
            <hr className="border-gray-300" />
            {field.label && (
              <div
                className={`-mt-3 ${field.align === 'left' ? 'text-left' : field.align === 'right' ? 'text-right' : 'text-center'
                  }`}
              >
                <span
                  className="bg-white px-4 text-sm font-bold"
                  style={{
                    color: field.color || '#3b82f6',
                    textShadow: '0 1px 4px rgba(59,130,246,0.15)'
                  }}
                >
                  {field.label}
                </span>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                Unsupported field type: {field.type}
              </p>
            </div>
          </div>
        );
    }
  };

  // Group fields by section with safe access
  const groupedFields = templateSections.length > 0
    ? templateSections.map(section => ({
      section,
      fields: templateFields.filter(field => field.section === section.id)
    }))
    : [{ section: null, fields: templateFields }];

  // Add unassigned fields if there are sections
  const unassignedFields = templateSections.length > 0
    ? templateFields.filter(field => !field.section)
    : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-8 relative">
      {/* Render sections */}
      {groupedFields.map(({ section, fields }, groupIndex) => {
        // Get color scheme for this section
        const colorScheme = section?.color
          ? SECTION_COLORS[section.color as keyof typeof SECTION_COLORS] || SECTION_COLORS.gray
          : SECTION_COLORS.gray;

        const isCollapsed = section ? collapsedSections.has(section.id) : false;
        const fieldsWithErrors = fields.filter(field => errors[field.name]);
        const hasErrors = fieldsWithErrors.length > 0;

        return (
          <div key={section?.id || 'main'} className="space-y-4">
            {section && (
              <div className={`border rounded-lg shadow-sm overflow-visible transition-all duration-200 ${colorScheme.border} ${hasErrors ? 'ring-2 ring-red-200' : ''}`}>
                {/* Color accent bar */}
                <div className={`h-1 ${colorScheme.accent} opacity-60`}></div>

                {/* Section header - clickable */}
                <div
                  className={`${colorScheme.bg} px-6 py-4 cursor-pointer transition-colors ${colorScheme.hover} ${!isCollapsed ? `border-b ${colorScheme.border}` : ''}`}
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        {isCollapsed ? (
                          <ChevronRight className={`w-5 h-5 mr-3 ${colorScheme.text.replace('-900', '-600')}`} />
                        ) : (
                          <ChevronDown className={`w-5 h-5 mr-3 ${colorScheme.text.replace('-900', '-600')}`} />
                        )}
                        <h3 className={`text-lg font-semibold ${colorScheme.text}`}>{section.name}</h3>
                      </div>
                      {section.description && !isCollapsed && (
                        <p className={`text-sm mt-1 ml-8 ${colorScheme.text.replace('-900', '-600')}`}>{section.description}</p>
                      )}
                    </div>

                    {/* Section status indicators */}
                    <div className="flex items-center space-x-2 ml-4">
                      {hasErrors && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          {fieldsWithErrors.length} error{fieldsWithErrors.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${colorScheme.bg} ${colorScheme.text.replace('-900', '-700')} border ${colorScheme.border}`}>
                        {fields.length} field{fields.length !== 1 ? 's' : ''}
                      </span>
                      {isCollapsed && (
                        <span className="text-xs text-gray-500">
                          Click to expand
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section content - collapsible */}
                {!isCollapsed && (
                  <div className="bg-white px-6 py-6 transition-all duration-200">
                    <div className="flex flex-wrap -mx-2">
                      {fields.map(renderField)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* For sections without header (fallback) */}
            {!section && (
              <div className="flex flex-wrap -mx-2">
                {fields.map(renderField)}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned fields */}
      {unassignedFields.length > 0 && (
        <div className="space-y-4">
          <div className="border-b border-gray-200 pb-3 mb-6">
            <h3 className="text-lg font-semibold text-gray-700">Additional Information</h3>
          </div>

          <div className="flex flex-wrap -mx-2">
            {unassignedFields.map(renderField)}
          </div>
        </div>
      )}

      {!isPreview && (
        <div className="flex justify-end items-center pt-6 border-t border-gray-200 mt-8 gap-4">
          <button
            type="submit"
            className="bg-brand hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center shadow-sm"
          >
            <Save className="w-5 h-5 mr-2" />
            Submit Record
          </button>
        </div>
      )}
    </form>
  );
};
