import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import {
  gregorianToEthiopian,
  ethiopianToGregorian,
  formatEthiopianDate,
  parseEthiopianDate,
  isValidEthiopianDate,
  ETHIOPIAN_MONTHS,
  EthiopianDate
} from '../utils/ethiopianCalendar';

interface EthiopianDateInputProps {
  value: string; // Gregorian date string (YYYY-MM-DD)
  onChange: (gregorianDate: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
}

export const EthiopianDateInput: React.FC<EthiopianDateInputProps> = ({
  value,
  onChange,
  name,
  required = false,
  disabled = false,
  className = '',
  label,
  error
}) => {
  const [ethDate, setEthDate] = useState<EthiopianDate>(() => {
    if (value) {
      const gregDate = new Date(value);
      return gregorianToEthiopian(gregDate);
    }
    return gregorianToEthiopian(new Date());
  });

  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (value) {
      const gregDate = new Date(value);
      if (!isNaN(gregDate.getTime())) {
        setEthDate(gregorianToEthiopian(gregDate));
      }
    }
  }, [value]);

  const handleDateChange = (newEthDate: Partial<EthiopianDate>) => {
    const updatedDate = { ...ethDate, ...newEthDate };
    
    if (isValidEthiopianDate(updatedDate)) {
      setEthDate(updatedDate);
      const gregDate = ethiopianToGregorian(updatedDate);
      const year = gregDate.getFullYear();
      const month = String(gregDate.getMonth() + 1).padStart(2, '0');
      const day = String(gregDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const ethDateParsed = parseEthiopianDate(inputValue);
    
    if (ethDateParsed && isValidEthiopianDate(ethDateParsed)) {
      setEthDate(ethDateParsed);
      const gregDate = ethiopianToGregorian(ethDateParsed);
      const year = gregDate.getFullYear();
      const month = String(gregDate.getMonth() + 1).padStart(2, '0');
      const day = String(gregDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    }
  };

  const years = Array.from({ length: 100 }, (_, i) => ethDate.year - 50 + i);
  const days = Array.from({ length: ethDate.month === 13 ? 6 : 30 }, (_, i) => i + 1);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          type="text"
          name={name}
          value={formatEthiopianDate(ethDate)}
          onChange={handleInputChange}
          onFocus={() => setShowPicker(true)}
          disabled={disabled}
          placeholder="DD/MM/YYYY (Ethiopian)"
          className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          required={required}
        />
        <Calendar 
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" 
        />
      </div>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {showPicker && !disabled && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute z-50 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={ethDate.day}
                  onChange={(e) => handleDateChange({ day: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {days.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={ethDate.month}
                  onChange={(e) => handleDateChange({ month: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {ETHIOPIAN_MONTHS.map((month, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={ethDate.year}
                  onChange={(e) => handleDateChange({ year: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-gray-600 text-center pt-2 border-t">
              Ethiopian: {formatEthiopianDate(ethDate, 'long')}
            </div>

            <button
              onClick={() => setShowPicker(false)}
              className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
};
