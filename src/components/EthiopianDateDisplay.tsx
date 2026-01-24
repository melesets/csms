import React from 'react';
import { gregorianToEthiopian, formatEthiopianDate } from '../utils/ethiopianCalendar';

interface EthiopianDateDisplayProps {
  date: string | Date;
  format?: 'short' | 'long';
  className?: string;
  showGregorian?: boolean;
}

export const EthiopianDateDisplay: React.FC<EthiopianDateDisplayProps> = ({
  date,
  format = 'short',
  className = '',
  showGregorian = false
}) => {
  if (!date) return <span className={className}>-</span>;

  const gregDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(gregDate.getTime())) {
    return <span className={className}>Invalid Date</span>;
  }

  const ethDate = gregorianToEthiopian(gregDate);
  const ethDateString = formatEthiopianDate(ethDate, format);

  if (showGregorian) {
    const gregDateString = gregDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    return (
      <span className={className} title={`Gregorian: ${gregDateString}`}>
        {ethDateString}
      </span>
    );
  }

  return <span className={className}>{ethDateString}</span>;
};
