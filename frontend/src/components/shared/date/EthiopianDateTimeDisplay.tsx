// Ethiopian calendar date and time display
// Includes badge, range, and timestamp card variants
import React from 'react';
import { Clock, Calendar } from 'lucide-react';
import {
  gregorianToEthiopian,
  gregorianToEthiopianTime,
  formatEthiopianDate,
  formatEthiopianTime,
  formatEthiopianRelativeTime,
  getEthiopianWeekdayName,
  EthiopianDate,
  EthiopianTime
} from '../../../utils/ethiopianCalendar';

interface EthiopianDateTimeDisplayProps {
  date: string | Date;
  showTime?: boolean;
  showDate?: boolean;
  showWeekday?: boolean;
  showRelative?: boolean;
  format?: 'short' | 'long';
  className?: string;
  showGregorian?: boolean;
  showIcon?: boolean;
  iconSize?: 'sm' | 'md' | 'lg';
  inline?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * EthiopianDateTimeDisplay - A versatile component for displaying dates and times in Ethiopian format
 *
 * Features:
 * - Ethiopian calendar conversion
 * - Ethiopian time (6-hour offset)
 * - Relative time ("2 hours ago", "Yesterday")
 * - Amharic weekday names
 * - Gregorian fallback option
 */
export const EthiopianDateTimeDisplay: React.FC<EthiopianDateTimeDisplayProps> = ({
  date,
  showTime = false,
  showDate = true,
  showWeekday = false,
  showRelative = false,
  format = 'short',
  className = '',
  showGregorian = false,
  showIcon = false,
  iconSize = 'sm',
  inline = false,
  size = 'sm'
}) => {
  if (!date) return <span className={className}>-</span>;

  const gregDate = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(gregDate.getTime())) {
    return <span className={className}>Invalid Date</span>;
  }

  const ethDate = gregorianToEthiopian(gregDate);
  const ethTime = gregorianToEthiopianTime(gregDate);

  // Size classes
  const sizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Build display string
  const buildDisplay = (): string => {
    if (showRelative) {
      return formatEthiopianRelativeTime(gregDate);
    }

    const parts: string[] = [];

    if (showWeekday) {
      parts.push(getEthiopianWeekdayName(gregDate, 'short'));
    }

    if (showDate) {
      parts.push(formatEthiopianDate(ethDate, format));
    }

    if (showTime) {
      parts.push(formatEthiopianTime(ethTime, 'short'));
    }

    return parts.join(' ');
  };

  // Build Gregorian tooltip
  const buildGregorianTooltip = (): string => {
    if (!showGregorian) return '';
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(showTime && { hour: '2-digit', minute: '2-digit' })
    };
    return `Gregorian: ${gregDate.toLocaleDateString('en-US', options)}`;
  };

  const displayText = buildDisplay();
  const tooltip = buildGregorianTooltip();

  const Wrapper = inline ? 'span' : 'div';

  return (
    <span
      className={`${inline ? 'inline-flex' : 'flex'} items-center gap-1 ${sizeClasses[size]} ${className}`}
      title={tooltip}
    >
      {showIcon && (
        showTime ? (
          <Clock className={`${iconSizeClasses[iconSize]} text-gray-400 flex-shrink-0`} />
        ) : (
          <Calendar className={`${iconSizeClasses[iconSize]} text-gray-400 flex-shrink-0`} />
        )
      )}
      <span className="text-inherit">{displayText}</span>
      {showGregorian && (
        <span className="text-gray-400 text-[10px] ml-1">
          (G: {gregDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
        </span>
      )}
    </span>
  );
};

/**
 * EthiopianDateBadge - A compact badge-style date display
 */
export const EthiopianDateBadge: React.FC<{
  date: string | Date;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ date, variant = 'default', size = 'md', className = '' }) => {
  if (!date) return null;

  const gregDate = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(gregDate.getTime())) return null;

  const ethDate = gregorianToEthiopian(gregDate);

  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    primary: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    danger: 'bg-red-100 text-red-700 border-red-200'
  };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {formatEthiopianDate(ethDate, 'short')}
    </span>
  );
};

/**
 * EthiopianTimeBadge - A compact badge-style time display
 */
export const EthiopianTimeBadge: React.FC<{
  date: string | Date;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ date, variant = 'default', size = 'md', className = '' }) => {
  if (!date) return null;

  const gregDate = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(gregDate.getTime())) return null;

  const ethTime = gregorianToEthiopianTime(gregDate);

  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    primary: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    danger: 'bg-red-100 text-red-700 border-red-200'
  };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      <Clock className="w-3 h-3 mr-1" />
      {formatEthiopianTime(ethTime, 'short')}
    </span>
  );
};

/**
 * EthiopianDateRange - Display a date range in Ethiopian format
 */
export const EthiopianDateRange: React.FC<{
  startDate: string | Date;
  endDate: string | Date;
  separator?: string;
  format?: 'short' | 'long';
  className?: string;
}> = ({ startDate, endDate, separator = ' - ', format = 'short', className = '' }) => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return <span className={className}>Invalid date range</span>;
  }

  const ethStart = gregorianToEthiopian(start);
  const ethEnd = gregorianToEthiopian(end);

  return (
    <span className={className}>
      {formatEthiopianDate(ethStart, format)}
      {separator}
      {formatEthiopianDate(ethEnd, format)}
    </span>
  );
};

/**
 * EthiopianTimestampCard - A card-style display for timestamps
 */
export const EthiopianTimestampCard: React.FC<{
  date: string | Date;
  label?: string;
  showIcon?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}> = ({ date, label, showIcon = true, variant = 'default', className = '' }) => {
  const gregDate = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(gregDate.getTime())) {
    return <span className={className}>Invalid Date</span>;
  }

  const ethDate = gregorianToEthiopian(gregDate);
  const ethTime = gregorianToEthiopianTime(gregDate);

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 text-xs ${className}`}>
        {showIcon && <Calendar className="w-3 h-3 text-gray-400" />}
        <span className="font-medium">{formatEthiopianDate(ethDate, 'short')}</span>
        <span className="text-gray-400">•</span>
        <span>{formatEthiopianTime(ethTime, 'short')}</span>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-3 ${className}`}>
      {label && (
        <div className="text-xs text-gray-500 mb-1">{label}</div>
      )}
      <div className="flex items-center gap-3">
        {showIcon && (
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
        )}
        <div>
          <div className="font-medium text-gray-900">
            {formatEthiopianDate(ethDate, 'long')}
          </div>
          <div className="text-sm text-gray-500">
            {formatEthiopianTime(ethTime, 'long')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EthiopianDateTimeDisplay;
