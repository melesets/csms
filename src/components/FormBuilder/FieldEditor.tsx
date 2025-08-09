import React from 'react';
import { Trash2, Settings } from 'lucide-react';
import { FormField, FormSection } from '../../types/formBuilder';

interface FieldEditorProps {
  field: FormField;
  sections: FormSection[];
  onUpdate: (field: FormField) => void;
  onDelete: (fieldId: string) => void;
}

export const FieldEditor: React.FC<FieldEditorProps> = ({ field, sections, onUpdate, onDelete }) => {
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
            <button
              onClick={addOption}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Option
            </button>
          </div>
          
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
      )}

      {/* Min/Max and Validation for numeric fields */}
      {needsValidation && (
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
      )}
    </div>
  );
};