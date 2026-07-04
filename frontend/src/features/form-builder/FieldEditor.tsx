// Field editor - edit individual form field properties and validation
import React from 'react';
import { Trash2, Settings, Eye, Calculator, Plus, X, AlertCircle, Database, Search } from 'lucide-react';
import { FormField, FormSection, SkipLogic, SkipCondition, CalculatedField, TerminologyConfig } from '../../types/formBuilder';
import { FormulaBuilder } from './FormulaBuilder';
import { ConceptPicker } from './ConceptPicker';

interface FieldEditorProps {
  field: FormField;
  sections: FormSection[];
  allFields?: FormField[];
  onUpdate: (field: FormField) => void;
  onDelete: (fieldId: string) => void;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'greater_or_equal', label: 'Greater than or equal' },
  { value: 'less_or_equal', label: 'Less than or equal' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'in_list', label: 'In list (comma separated)' },
];

export const FieldEditor: React.FC<FieldEditorProps> = ({ field, sections, allFields = [], onUpdate, onDelete }) => {
  const handleChange = (updates: Partial<FormField>) => {
    onUpdate({ ...field, ...updates });
  };

  const handleValidationChange = (updates: Partial<FormField['validation']>) => {
    handleChange({
      validation: { ...field.validation, ...updates }
    });
  };

  const handleOptionsChange = (options: Array<{ value: string; label: string }>) => {
    handleChange({ options });
  };

  const addOption = () => {
    const currentOptions = (field.options as Array<{ value: string; label: string }>) || [];
    const newOptionNumber = currentOptions.length + 1;
    handleOptionsChange([...currentOptions, {
      value: `option${newOptionNumber}`,
      label: `Option ${newOptionNumber}`
    }]);
  };

  const updateOption = (index: number, fieldName: 'value' | 'label', newValue: string) => {
    const currentOptions = (field.options as Array<{ value: string; label: string }>) || [];
    const newOptions = [...currentOptions];
    newOptions[index] = { ...newOptions[index], [fieldName]: newValue };
    handleOptionsChange(newOptions);
  };

  const removeOption = (index: number) => {
    const currentOptions = (field.options as Array<{ value: string; label: string }>) || [];
    handleOptionsChange(currentOptions.filter((_, i) => i !== index));
  };

  // Skip Logic Handlers
  const handleSkipLogicChange = (updates: Partial<SkipLogic>) => {
    handleChange({
      skipLogic: field.skipLogic ? { ...field.skipLogic, ...updates } : {
        action: 'show',
        operator: 'AND',
        conditions: [],
        ...updates
      }
    });
  };

  const addSkipCondition = () => {
    const newCondition: SkipCondition = {
      field: '',
      operator: 'equals',
      value: ''
    };
    handleSkipLogicChange({
      conditions: [...(field.skipLogic?.conditions || []), newCondition]
    });
  };

  const updateSkipCondition = (index: number, updates: Partial<SkipCondition>) => {
    const currentConditions = field.skipLogic?.conditions || [];
    const newConditions = [...currentConditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    handleSkipLogicChange({ conditions: newConditions });
  };

  const removeSkipCondition = (index: number) => {
    const currentConditions = field.skipLogic?.conditions || [];
    handleSkipLogicChange({
      conditions: currentConditions.filter((_, i) => i !== index)
    });
  };

  // Calculation Handlers
  const handleCalculationChange = (updates: Partial<CalculatedField>) => {
    handleChange({
      calculation: field.calculation ? { ...field.calculation, ...updates } : {
        formula: '',
        dependencies: [],
        resultType: 'number',
        ...updates
      },
      readonly: true // Calculated fields should be readonly by default
    });
  };

  const handleTerminologyChange = (updates: Partial<TerminologyConfig>) => {
    handleChange({
      terminology: {
        system: field.terminology?.system || 'ICD-11',
        ...updates
      }
    });
  };

  const currentFields = allFields.filter(f => f.id !== field.id); // Exclude self


  const needsOptions = ['select', 'dropdown', 'multiselect', 'radio', 'checkbox'].includes(field.type);
  const needsValidation = ['number', 'vital-signs', 'rating'].includes(field.type);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Settings className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Field Properties</h3>
        </div>
        <button
          onClick={() => onDelete(field.id)}
          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
          title="Delete field"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Basic Properties */}
      <div className="space-y-4">
        {field.type === 'divider' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Title (optional)
            </label>
            <input
              type="text"
              value={field.label || ''}
              onChange={(e) => handleChange({ label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Leave blank for divider without title"
            />
            <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
              Section/Divider Color
            </label>
            <input
              type="color"
              value={field.color || '#3b82f6'}
              onChange={e => handleChange({ color: e.target.value })}
              className="w-12 h-8 p-0 border-0 bg-transparent cursor-pointer"
              title="Pick a color for the section/divider text"
            />
            <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
              Title Alignment
            </label>
            <select
              value={field.align || 'center'}
              onChange={e => handleChange({ align: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field Label
            </label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => handleChange({ label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Field Name
          </label>
          <input
            type="text"
            value={field.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Section Assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Section Assignment
          </label>
          <select
            value={field.section || ''}
            onChange={(e) => handleChange({ section: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Unassigned</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Assign this field to a section to group related fields together
          </p>
        </div>

        {field.type !== 'divider' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Placeholder
            </label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => handleChange({ placeholder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Width
          </label>
          <select
            value={field.width || 'full'}
            onChange={(e) => handleChange({ width: e.target.value as FormField['width'] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="full">Full Width</option>
            <option value="half">Half Width</option>
            <option value="third">One Third</option>
            <option value="quarter">One Quarter</option>
          </select>
        </div>

        {field.type !== 'divider' && (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => handleChange({ required: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700">
              Required Field
            </label>
          </div>
        )}

        {/* Textarea rows */}
        {field.type === 'textarea' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rows
            </label>
            <input
              type="number"
              value={field.rows || 3}
              onChange={(e) => handleChange({ rows: parseInt(e.target.value) || 3 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="10"
            />
          </div>
        )}
      </div>

      {/* Options for select, dropdown, multiselect, radio, checkbox */}
      {needsOptions && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900">Options</h4>
            <div className="flex space-x-2">
              <button
                onClick={addOption}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Option
              </button>
              <button
                onClick={() => setShowOptionSearch(!showOptionSearch)}
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
              >
                <Database className="w-3 h-3 mr-1" />
                + Add from Dictionary
              </button>
            </div>
          </div>

          {showOptionSearch && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg mb-4">
              <h5 className="text-xs font-semibold text-purple-800 mb-2">Search Clinical Concept</h5>
              <ConceptPicker
                config={{ system: 'All' }}
                value={undefined}
                onChange={(concept) => {
                  if (concept) {
                    const currentOptions = (field.options as Array<any>) || [];
                    handleOptionsChange([...currentOptions, {
                      value: concept.code,
                      label: concept.display,
                      concept: concept
                    }]);
                    setShowOptionSearch(false);
                  }
                }}
                placeholder="Search options (e.g. Supine, Prone)..."
              />
              <button
                onClick={() => setShowOptionSearch(false)}
                className="text-xs text-gray-500 mt-2 hover:text-gray-700 underline"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="space-y-2">
            {((field.options as Array<{ value: string; label: string }>) || []).map((option, index) => (
              <div key={`option-${index}`} className="space-y-2 p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option.value}
                    onChange={(e) => updateOption(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => removeOption(index)}
                    className="p-2 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(index, 'label', e.target.value)}
                  placeholder="Display Label"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>
      )
      }

      {/* Min/Max and Validation for numeric fields */}
      {
        needsValidation && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">
              {field.type === 'number' ? 'Number Constraints' : 'Validation'}
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Value
                </label>
                <input
                  type="number"
                  value={field.min !== undefined ? field.min : (field.validation?.min || '')}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                    if (field.type === 'number') {
                      handleChange({ min: value });
                    } else {
                      handleValidationChange({ min: value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Value
                </label>
                <input
                  type="number"
                  value={field.max !== undefined ? field.max : (field.validation?.max || '')}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                    if (field.type === 'number') {
                      handleChange({ max: value });
                    } else {
                      handleValidationChange({ max: value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {field.type !== 'number' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Error Message
                </label>
                <input
                  type="text"
                  value={field.validation?.errorMessage || ''}
                  onChange={(e) => handleValidationChange({ errorMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Custom validation error message"
                />
              </div>
            )}
          </div>
        )
      }
      {/* Skip Logic Configuration */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Skip Logic</h3>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="skipLogicToggle"
              checked={!!field.skipLogic}
              onChange={(e) => {
                if (e.target.checked) {
                  handleChange({
                    skipLogic: {
                      action: 'show',
                      operator: 'AND',
                      conditions: []
                    }
                  });
                } else {
                  handleChange({ skipLogic: undefined });
                }
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="skipLogicToggle" className="ml-2 text-sm text-gray-700">
              Enable Logic
            </label>
          </div>
        </div>

        {field.skipLogic && (
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <select
                value={field.skipLogic.action}
                onChange={(e) => handleSkipLogicChange({ action: e.target.value as 'show' | 'hide' })}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="show">Show this field</option>
                <option value="hide">Hide this field</option>
              </select>
              <span className="text-sm text-gray-600">if</span>
              <select
                value={field.skipLogic.operator}
                onChange={(e) => handleSkipLogicChange({ operator: e.target.value as 'AND' | 'OR' })}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="AND">ALL</option>
                <option value="OR">ANY</option>
              </select>
              <span className="text-sm text-gray-600">of the following match:</span>
            </div>

            <div className="space-y-3">
              {field.skipLogic.conditions.map((condition, index) => (
                <div key={index} className="flex flex-wrap gap-2 items-start p-3 bg-white border border-gray-200 rounded">
                  <select
                    value={condition.field}
                    onChange={(e) => updateSkipCondition(index, { field: e.target.value })}
                    className="flex-1 min-w-[120px] px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value="">Select Field</option>
                    {currentFields.map(f => (
                      <option key={f.id} value={f.name}>{f.label || f.name}</option>
                    ))}
                  </select>

                  <select
                    value={condition.operator}
                    onChange={(e) => updateSkipCondition(index, { operator: e.target.value as any })}
                    className="w-[120px] px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  <div className="flex-1 min-w-[120px] flex gap-1">
                    {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateSkipCondition(index, { value: e.target.value })}
                        placeholder="Value"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    )}
                  </div>

                  <button
                    onClick={() => removeSkipCondition(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addSkipCondition}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Condition
            </button>
          </div>
        )}
      </div>

      {/* Calculated Field Configuration */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Calculator className="w-5 h-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Calculated Field</h3>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="calcFieldToggle"
              checked={!!field.calculation}
              onChange={(e) => {
                if (e.target.checked) {
                  handleChange({
                    calculation: {
                      formula: '',
                      dependencies: [],
                      resultType: 'number'
                    },
                    readonly: true
                  });
                } else {
                  handleChange({ calculation: undefined, readonly: false });
                }
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="calcFieldToggle" className="ml-2 text-sm text-gray-700">
              Enable Calculation
            </label>
          </div>
        </div>

        {field.calculation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result Type</label>
                <select
                  value={field.calculation.resultType}
                  onChange={(e) => handleCalculationChange({ resultType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                  <option value="boolean">Boolean (True/False)</option>
                </select>
              </div>

              {field.calculation.resultType === 'number' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Decimal Places</label>
                  <input
                    type="number"
                    value={field.calculation.roundTo ?? ''}
                    onChange={(e) => handleCalculationChange({
                      roundTo: e.target.value === '' ? undefined : parseInt(e.target.value)
                    })}
                    placeholder="None"
                    min="0"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            <FormulaBuilder
              formula={field.calculation.formula}
              fields={allFields}
              currentFieldId={field.id}
              onChange={(newFormula) => {
                // Auto-detect dependencies
                const dependencies = allFields
                  .filter(f => newFormula.includes(f.name))
                  .map(f => f.name);

                handleCalculationChange({
                  formula: newFormula,
                  dependencies
                });
              }}
            />

            <div className="text-xs text-gray-500 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <p>Calculated fields are automatically set to read-only. The value will be computed when the form is filled out.</p>
            </div>
          </div>
        )}
      </div>

      {/* Terminology Configuration */}
      {
        (field.type === 'coded-text' || field.terminology) && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Database className="w-5 h-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Clinical Terminology</h3>
              </div>
            </div>

            <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coding System</label>
                <select
                  value={field.terminology?.system || 'ICD-11'}
                  onChange={(e) => handleTerminologyChange({ system: e.target.value as any })}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ICD-11">ICD-11 (Diagnoses)</option>
                  <option value="LOINC">LOINC (Labs & Vitals)</option>
                  <option value="UCUM">UCUM (Units)</option>
                </select>
              </div>

              {field.terminology?.system === 'LOINC' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subset / Category</label>
                  <select
                    value={field.terminology?.subset || ''}
                    onChange={(e) => handleTerminologyChange({ subset: e.target.value })}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All LOINC Codes</option>
                    <option value="Vital Signs">Vital Signs</option>
                    <option value="Labs">Laboratory Tests</option>
                  </select>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowMultipleTerm"
                  checked={field.terminology?.allowMultiple || false}
                  onChange={(e) => handleTerminologyChange({ allowMultiple: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="allowMultipleTerm" className="ml-2 text-sm text-gray-700">
                  Allow selecting multiple values
                </label>
              </div>

              {/* Preview / Test Search area */}
              <div className="mt-4 pt-4 border-t border-blue-200">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Test Search Preview
                </label>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <ConceptPicker
                    config={field.terminology || { system: 'ICD-11' }}
                    value={undefined}
                    onChange={() => { }}
                    placeholder={`Search ${field.terminology?.system || 'ICD-11'} codes...`}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Try searching for terms like "Diabetes", "Blood", "mg", etc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};
