import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MinimalistMultiSelectProps {
  options: Option[] | string[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const MinimalistMultiSelect: React.FC<MinimalistMultiSelectProps> = ({
  options,
  value = [],
  onChange,
  disabled = false,
  placeholder = "Select options...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options to always be objects
  const normalizedOptions: Option[] = options.map(option => 
    typeof option === 'string' 
      ? { value: option, label: option }
      : option
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (optionValue: string) => {
    if (disabled) return;
    
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    
    onChange(newValue);
  };

  const handleRemoveOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    
    const newValue = value.filter(v => v !== optionValue);
    onChange(newValue);
  };

  const getSelectedLabels = () => {
    // Remove duplicates from value array first
    const uniqueValues = [...new Set(value)];
    return uniqueValues.map(val => {
      const option = normalizedOptions.find(opt => opt.value === val);
      return { value: val, label: option ? option.label : val };
    });
  };

  const selectedItems = getSelectedLabels();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Input */}
      <div
        className={`w-full px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
          disabled 
            ? 'bg-gray-50 cursor-not-allowed border-gray-200' 
            : isOpen 
              ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20' 
              : 'border-gray-300 hover:border-gray-400'
        } ${className}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {selectedItems.length === 0 ? (
              <span className="text-gray-500 text-sm">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedItems.map((item) => (
                  <span
                    key={item.value}
                    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                  >
                    {item.label}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveOption(item.value, e)}
                        className="ml-1 hover:text-blue-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`} 
          />
        </div>
      </div>

      {/* Dropdown Options */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {normalizedOptions.length === 0 ? (
            <div className="px-4 py-2 text-gray-500 text-sm">No options available</div>
          ) : (
            normalizedOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={value.includes(option.value)}
                  onChange={() => handleToggleOption(option.value)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-3 text-sm text-gray-700">{option.label}</span>
              </label>
            ))
          )}
          
          {/* Clear All / Select All Actions */}
          {normalizedOptions.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-2 flex justify-between">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-gray-700"
                disabled={value.length === 0}
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => onChange(normalizedOptions.map(opt => opt.value))}
                className="text-xs text-blue-600 hover:text-blue-800"
                disabled={value.length === normalizedOptions.length}
              >
                Select All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
