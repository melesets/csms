import React from 'react';
import { Trash2, Settings } from 'lucide-react';
import { FormField } from '../../types/formBuilder';

interface FieldEditorProps {
  field: FormField;
  onUpdate: (field: FormField) => void;
  onDelete: (fieldId: string) => void;
}

export const FieldEditor: React.FC<FieldEditorProps> = ({ field, onUpdate, onDelete }) => {
  const handleChange = (updates: Partial<FormField>) => {
    onUpdate({ ...field, ...updates });
  };

  const handleValidationChange = (updates: Partial<FormField['validation']>) => {
    handleChange({
      validation: { ...field.validation, ...updates }
    });
  };

  const handleOptionsChange = (options: string[]) => {
    handleChange({ options });
  };

  const addOption = () => {
    const currentOptions = field.options || [];
    handleOptionsChange([...currentOptions, `Option ${currentOptions.length + 1}`]);
  };

  const updateOption = (index: number, value: string) => {
    const currentOptions = field.options || [];
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    handleOptionsChange(newOptions);
  };

  const removeOption = (index: number) => {
    const currentOptions = field.options || [];
    handleOptionsChange(currentOptions.filter((_, i) => i !== index));
  };

  const needsOptions = ['dropdown', 'multiselect'].includes(field.type);
  const needsValidation = ['number', 'temperature', 'heart-rate', 'o2-saturation', 'pain-scale', 'range'].includes(field.type);

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
            value={field.width}
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
      </div>

      {/* Options for dropdown and multiselect */}
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
            {(field.options || []).map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => removeOption(index)}
                  className="p-2 text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation for numeric fields */}
      {needsValidation && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">Validation</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Value
              </label>
              <input
                type="number"
                value={field.validation?.min || ''}
                onChange={(e) => handleValidationChange({ min: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Value
              </label>
              <input
                type="number"
                value={field.validation?.max || ''}
                onChange={(e) => handleValidationChange({ max: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

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
        </div>
      )}
    </div>
  );
};