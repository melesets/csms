import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { FormTemplate, FormField } from '../../types/formBuilder';

interface DynamicFormRendererProps {
  template: FormTemplate;
  onSubmit: (data: Record<string, any>) => void;
  isPreview?: boolean;
  initialData?: Record<string, any>;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({ 
  template, 
  onSubmit, 
  isPreview = false,
  initialData = {}
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (field.required && (!value || value === '')) {
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
    
    // Validate all fields
    template.fields.forEach(field => {
      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onSubmit(formData);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const disabled = isPreview;

    const getWidthClass = () => {
      switch (field.width) {
        case 'half': return 'md:w-1/2';
        case 'third': return 'md:w-1/3';
        case 'quarter': return 'md:w-1/4';
        default: return 'w-full';
      }
    };

    const baseInputClass = `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      error ? 'border-red-300' : 'border-gray-300'
    } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`;

    switch (field.type) {
      case 'text':
      case 'isbar-situation':
      case 'isbar-background':
      case 'isbar-assessment':
      case 'isbar-recommendation':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.type.startsWith('isbar-') ? (
              <textarea
                value={value}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                disabled={disabled}
                className={`${baseInputClass} resize-none`}
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={disabled}
                className={baseInputClass}
              />
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'number':
      case 'temperature':
      case 'heart-rate':
      case 'o2-saturation':
      case 'pain-scale':
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
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.type === 'temperature' ? 0.1 : 1}
              disabled={disabled}
              className={baseInputClass}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'blood-pressure':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder || '120/80'}
              disabled={disabled}
              className={baseInputClass}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

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
              <option value="">Select an option</option>
              {field.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
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
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <div key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`${field.name}-${index}`}
                    checked={(value || []).includes(option)}
                    onChange={(e) => {
                      const currentValue = value || [];
                      const newValue = e.target.checked
                        ? [...currentValue, option]
                        : currentValue.filter((v: string) => v !== option);
                      handleInputChange(field.name, newValue);
                    }}
                    disabled={disabled}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor={`${field.name}-${index}`} className="ml-2 text-sm text-gray-700">
                    {option}
                  </label>
                </div>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              disabled={disabled}
              className={`${baseInputClass} resize-none`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              disabled={disabled}
              className={baseInputClass}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
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

      case 'range':
        return (
          <div key={field.id} className={`${getWidthClass()} px-2 mb-4`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}: {value || field.validation?.min || 0}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="range"
              value={value || field.validation?.min || 0}
              onChange={(e) => handleInputChange(field.name, parseInt(e.target.value))}
              min={field.validation?.min || 0}
              max={field.validation?.max || 100}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case 'divider':
        return (
          <div key={field.id} className="w-full px-2 mb-6">
            <hr className="border-gray-300" />
            {field.label && (
              <div className="text-center -mt-3">
                <span className="bg-white px-4 text-sm font-medium text-gray-500">
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap -mx-2">
        {template.fields.map(renderField)}
      </div>

      {!isPreview && (
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center"
          >
            <Save className="w-5 h-5 mr-2" />
            Submit Form
          </button>
        </div>
      )}
    </form>
  );
};