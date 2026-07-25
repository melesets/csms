// Reusable custom select dropdown matching app style
import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  minWidth?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  minWidth = '160px',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-left bg-gray-50 hover:bg-white hover:border-gray-300 focus:ring-2 focus:ring-gray-200 focus:border-transparent transition-all duration-200 cursor-pointer flex items-center justify-between"
      >
        {selected ? (
          <span className="text-gray-900">{selected.label}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg" style={{ width: '100%', minWidth }}>
          <div className="max-h-60 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`block w-full px-3 py-2 text-sm text-left transition-colors duration-150 ${
                  value === opt.value
                    ? 'bg-gray-100 text-gray-900 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
