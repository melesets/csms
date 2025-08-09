import React, { useState, useRef, useEffect } from 'react';

interface CustomMultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const CustomMultiSelect: React.FC<CustomMultiSelectProps> = ({ options, value, onChange, disabled, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionToggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`w-full px-4 py-2 border rounded-lg text-left bg-white ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        {value.length > 0 ? value.join(', ') : (placeholder || 'Select options')}
        <span className="float-right">▼</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option, idx) => (
            <label key={idx} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={() => handleOptionToggle(option)}
                className="mr-2"
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
