// Ethiopian calendar date and time picker
// Full calendar grid with time selection and Ethiopian time period support
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import {
  gregorianToEthiopian,
  ethiopianToGregorian,
  formatEthiopianDate,
  formatEthiopianTime,
  formatEthiopianDateTime,
  isValidEthiopianDate,
  getCurrentEthiopianDateTime,
  getEthiopianDateOptions,
  getEthiopianTimeOptions,
  gregorianToEthiopianTime,
  ethiopianTimeToGregorian,
  EthiopianDate,
  EthiopianTime,
  EthiopianDateTime,
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_WEEKDAYS
} from '../../../utils/ethiopianCalendar';

interface EthiopianDateTimePickerProps {
  value?: string; // ISO date string (YYYY-MM-DD) or ISO datetime string
  onChange: (gregorianDateTime: string) => void;
  showTime?: boolean;
  showDate?: boolean;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  minDate?: string; // Minimum date (Gregorian)
  maxDate?: string; // Maximum date (Gregorian)
  defaultToNow?: boolean;
}

export const EthiopianDateTimePicker: React.FC<EthiopianDateTimePickerProps> = ({
  value,
  onChange,
  showTime = true,
  showDate = true,
  label,
  required = false,
  disabled = false,
  error,
  className = '',
  placeholder,
  minDate,
  maxDate,
  defaultToNow = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize state from value or current date/time
  const initializeState = (): { ethDate: EthiopianDate; ethTime: EthiopianTime } => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return {
          ethDate: gregorianToEthiopian(date),
          ethTime: gregorianToEthiopianTime(date)
        };
      }
    }
    if (defaultToNow) {
      const now = new Date();
      return {
        ethDate: gregorianToEthiopian(now),
        ethTime: gregorianToEthiopianTime(now)
      };
    }
    const now = new Date();
    return {
      ethDate: gregorianToEthiopian(now),
      ethTime: { hour: 12, minute: 0, period: 'day' }
    };
  };

  const [ethDate, setEthDate] = useState<EthiopianDate>(() => initializeState().ethDate);
  const [ethTime, setEthTime] = useState<EthiopianTime>(() => initializeState().ethTime);
  const [viewYear, setViewYear] = useState<number>(() => ethDate.year);
  const [viewMonth, setViewMonth] = useState<number>(() => ethDate.month);

  // Update state when value prop changes
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const newEthDate = gregorianToEthiopian(date);
        const newEthTime = gregorianToEthiopianTime(date);
        setEthDate(newEthDate);
        setEthTime(newEthTime);
        setViewYear(newEthDate.year);
        setViewMonth(newEthDate.month);
      }
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle date selection
  const handleDateSelect = (day: number) => {
    const newDate: EthiopianDate = { ...ethDate, day, month: viewMonth, year: viewYear };
    if (isValidEthiopianDate(newDate)) {
      setEthDate(newDate);
      emitChange(newDate, ethTime);
      if (showTime) {
        setActiveTab('time');
      } else {
        setIsOpen(false);
      }
    }
  };

  // Handle time selection
  const handleTimeChange = (hour: number, minute: number, period: 'day' | 'night') => {
    const newTime: EthiopianTime = { hour, minute, period };
    setEthTime(newTime);
    emitChange(ethDate, newTime);
  };

  // Emit change to parent
  const emitChange = (date: EthiopianDate, time: EthiopianTime) => {
    const gregDate = ethiopianToGregorian(date);
    const gregTime = ethiopianTimeToGregorian(time);

    gregDate.setHours(gregTime.hours, gregTime.minutes, 0, 0);

    if (showDate && showTime) {
      onChange(gregDate.toISOString());
    } else if (showDate) {
      // Date only - format as YYYY-MM-DD
      const year = gregDate.getFullYear();
      const month = String(gregDate.getMonth() + 1).padStart(2, '0');
      const day = String(gregDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    } else {
      // Time only
      onChange(`${String(gregTime.hours).padStart(2, '0')}:${String(gregTime.minutes).padStart(2, '0')}:00`);
    }
  };

  // Get days in month
  const getDaysInMonth = (year: number, month: number): number => {
    if (month === 13) {
      return year % 4 === 3 ? 6 : 5; // Pagume
    }
    return 30; // All other months have 30 days
  };

  // Get the day of week for the first day of the month
  const getFirstDayOfMonth = (year: number, month: number): number => {
    const tempDate = ethiopianToGregorian({ year, month, day: 1 });
    return tempDate.getDay();
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (viewMonth === 1) {
        setViewMonth(13);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    } else {
      if (viewMonth === 13) {
        setViewMonth(1);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    }
  };

  // Navigate years
  const navigateYear = (direction: 'prev' | 'next') => {
    setViewYear(viewYear + (direction === 'prev' ? -1 : 1));
  };

  // Set to today
  const setToNow = () => {
    const now = getCurrentEthiopianDateTime();
    setEthDate({ year: now.year, month: now.month, day: now.day });
    setEthTime({ hour: now.hour, minute: now.minute, period: now.period });
    setViewYear(now.year);
    setViewMonth(now.month);
    emitChange({ year: now.year, month: now.month, day: now.day }, { hour: now.hour, minute: now.minute, period: now.period });
    setIsOpen(false);
  };

  // Clear selection
  const clearSelection = () => {
    if (defaultToNow) {
      setToNow();
    } else {
      onChange('');
      setIsOpen(false);
    }
  };

  // Format display value
  const displayValue = (): string => {
    if (!value && !defaultToNow) return '';

    if (showDate && showTime) {
      return formatEthiopianDateTime({ ...ethDate, ...ethTime }, 'short');
    } else if (showDate) {
      return formatEthiopianDate(ethDate, 'short');
    } else if (showTime) {
      return formatEthiopianTime(ethTime, 'short');
    }
    return '';
  };

  // Days array for calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const calendarDays: (number | null)[] = [];

  // Add empty slots for days before first day of month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  // Add actual days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const timeOptions = getEthiopianTimeOptions();

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Field */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-4 py-2.5 text-left border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
            error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-white cursor-pointer'}`}
          placeholder={placeholder || (showDate && showTime ? 'Select date and time' : showDate ? 'Select date' : 'Select time')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showDate && <Calendar className="w-4 h-4 text-gray-400" />}
              {showTime && <Clock className="w-4 h-4 text-gray-400" />}
              <span className={displayValue() ? 'text-gray-900' : 'text-gray-400'}>
                {displayValue() || placeholder || (showDate && showTime ? 'Select date and time' : showDate ? 'Select date' : 'Select time')}
              </span>
            </div>
            {displayValue() && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </button>
      </div>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl w-80 animate-in fade-in slide-in-from-top-2">
          {/* Tabs */}
          {showDate && showTime && (
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveTab('date')}
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'date' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Date
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('time')}
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'time' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                Time
              </button>
            </div>
          )}

          {/* Date Picker */}
          {(!showTime || activeTab === 'date') && showDate && (
            <div className="p-4">
              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => navigateYear('prev')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Previous year"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                  <ChevronLeft className="w-4 h-4 text-gray-600 -ml-3" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateMonth('prev')}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="text-center min-w-[140px]">
                    <div className="text-sm font-bold text-gray-900">{ETHIOPIAN_MONTHS[viewMonth - 1]}</div>
                    <div className="text-xs text-gray-500">{viewYear}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateMonth('next')}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Next month"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigateYear('next')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Next year"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                  <ChevronRight className="w-4 h-4 text-gray-600 -ml-3" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {ETHIOPIAN_WEEKDAYS_SHORT.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={day === null}
                    onClick={() => day !== null && handleDateSelect(day)}
                    className={`p-2 text-sm rounded-lg transition-all ${
                      day === null
                        ? 'invisible'
                        : day === ethDate.day && viewMonth === ethDate.month && viewYear === ethDate.year
                        ? 'bg-brand text-white hover:bg-brand-600'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Today Button */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={setToNow}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Today
                </button>
                <div className="text-xs text-gray-500">
                  {formatEthiopianDate(ethDate, 'long')}
                </div>
              </div>
            </div>
          )}

          {/* Time Picker */}
          {(!showDate || activeTab === 'time') && showTime && (
            <div className="p-4">
              {/* Ethiopian Time Display */}
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-gray-900">
                  {formatEthiopianTime(ethTime, 'long')}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Ethiopian Time (ሰዓት)
                </div>
              </div>

              {/* Time Period Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Period</label>
                <div className="grid grid-cols-2 gap-2">
                  {timeOptions.periods.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handleTimeChange(ethTime.hour, ethTime.minute, p.value)}
                      className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                        ethTime.period === p.value
                          ? 'bg-brand text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div>{p.amharic}</div>
                      <div className="text-xs opacity-80">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hour Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Hour (1-12)</label>
                <div className="grid grid-cols-6 gap-1">
                  {timeOptions.hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleTimeChange(h, ethTime.minute, ethTime.period)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        ethTime.hour === h
                          ? 'bg-brand text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Minute</label>
                <div className="grid grid-cols-6 gap-1">
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleTimeChange(ethTime.hour, m, ethTime.period)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        ethTime.minute === m
                          ? 'bg-brand text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={setToNow}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Now
                </button>
                {showDate && (
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-1 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-600 text-sm font-medium"
                  >
                    <Check className="w-4 h-4" />
                    Done
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EthiopianDateTimePicker;
