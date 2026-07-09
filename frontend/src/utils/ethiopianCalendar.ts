// Ethiopian calendar utilities - date conversion and formatting functions
// Ethiopian Time System:
// - Ethiopia uses a 12-hour clock starting at 6:00 AM (sunrise)
// - 6:00 AM GMT = 0:00 Ethiopian (first hour of the day)
// - 12:00 PM GMT = 6:00 Ethiopian (6th hour of the day)
// - 6:00 PM GMT = 12:00 Ethiopian (start of evening)

export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
}

export interface EthiopianDateTime extends EthiopianDate {
  hour: number;     // 0-11 (Ethiopian hours)
  minute: number;   // 0-59
  second: number;   // 0-59
  period: 'day' | 'night'; // day (6AM-6PM GMT) or night (6PM-6AM GMT)
}

export interface EthiopianTime {
  hour: number;     // 0-11 (Ethiopian hours)
  minute: number;   // 0-59
  period: 'day' | 'night'; // day (morning/afternoon) or night (evening/night)
}

export const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume'
];

export const ETHIOPIAN_MONTHS_SHORT = [
  'Mes', 'Tik', 'Hid', 'Tah', 'Tir', 'Yek',
  'Meg', 'Mia', 'Gin', 'Sen', 'Ham', 'Neh', 'Pag'
];

export const ETHIOPIAN_MONTHS_AMHARIC = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ταход', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

export const ETHIOPIAN_WEEKDAYS = [
  'Ehud',      // Sunday
  'Segno',     // Monday
  'Maksegno',  // Tuesday
  'Erob',      // Wednesday
  'Hamus',     // Thursday
  'Arb',       // Friday
  'Kidame'     // Saturday
];

export const ETHIOPIAN_WEEKDAYS_SHORT = [
  'Ehu', 'Seg', 'Mak', 'Ero', 'Ham', 'Arb', 'Kid'
];

// Ethiopian time period labels
export const ETHIOPIAN_TIME_PERIODS = {
  morning: 'Tewaga',      // Morning (before noon Ethiopian time)
  afternoon: 'Kelete',   // Afternoon (after noon Ethiopian time)
  evening: 'Mata',       // Evening (after 6 PM Ethiopian time)
  night: 'Leyi'          // Night (late night)
};

/**
 * Convert Gregorian date to Ethiopian date
 */
export function gregorianToEthiopian(date: Date): EthiopianDate {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  
  let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + 
            Math.floor(y / 4) - Math.floor(y / 100) + 
            Math.floor(y / 400) - 32045;

  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  
  const ethYear = 4 * Math.floor((jdn - 1723856) / 1461) + 
                  Math.floor(r / 365) - Math.floor(r / 1460);
  const ethMonth = Math.floor(n / 30) + 1;
  const ethDay = (n % 30) + 1;

  return {
    year: ethYear,
    month: ethMonth,
    day: ethDay
  };
}

/**
 * Convert Ethiopian date to Gregorian date
 */
export function ethiopianToGregorian(ethDate: EthiopianDate): Date {
  const { year, month, day } = ethDate;

  const jdn = (365 * year) + Math.floor(year / 4) + 
              (30 * (month - 1)) + day + 1723856;

  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  const gregDay = e - Math.floor((153 * m + 2) / 5) + 1;
  const gregMonth = m + 3 - 12 * Math.floor(m / 10);
  const gregYear = 100 * b + d - 4800 + Math.floor(m / 10);

  return new Date(gregYear, gregMonth - 1, gregDay);
}

/**
 * Format Ethiopian date as string
 */
export function formatEthiopianDate(ethDate: EthiopianDate, format: 'short' | 'long' | 'amharic' = 'short'): string {
  const { year, month, day } = ethDate;
  
  if (format === 'long') {
    return `${ETHIOPIAN_MONTHS[month - 1]} ${day}, ${year}`;
  }
  
  if (format === 'amharic') {
    return `${day} ${ETHIOPIAN_MONTHS_AMHARIC[month - 1]} ${year}`;
  }
  
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Parse Ethiopian date string (DD/MM/YYYY) to EthiopianDate object
 */
export function parseEthiopianDate(dateString: string): EthiopianDate | null {
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 13) return null;
  if (day < 1 || day > 30) return null;

  return { year, month, day };
}

/**
 * Get current Ethiopian date
 */
export function getCurrentEthiopianDate(): EthiopianDate {
  return gregorianToEthiopian(new Date());
}

/**
 * Convert Gregorian date string (YYYY-MM-DD) to Ethiopian date string (DD/MM/YYYY)
 */
export function gregorianStringToEthiopianString(gregorianDateString: string): string {
  if (!gregorianDateString) return '';
  
  const date = new Date(gregorianDateString);
  if (isNaN(date.getTime())) return '';
  
  const ethDate = gregorianToEthiopian(date);
  return formatEthiopianDate(ethDate);
}

/**
 * Convert Ethiopian date string (DD/MM/YYYY) to Gregorian date string (YYYY-MM-DD)
 */
export function ethiopianStringToGregorianString(ethiopianDateString: string): string {
  if (!ethiopianDateString) return '';
  
  const ethDate = parseEthiopianDate(ethiopianDateString);
  if (!ethDate) return '';
  
  const gregDate = ethiopianToGregorian(ethDate);
  const year = gregDate.getFullYear();
  const month = String(gregDate.getMonth() + 1).padStart(2, '0');
  const day = String(gregDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Validate Ethiopian date
 */
export function isValidEthiopianDate(ethDate: EthiopianDate): boolean {
  const { year, month, day } = ethDate;

  if (month < 1 || month > 13) return false;
  if (day < 1) return false;

  if (month === 13) {
    const isLeapYear = year % 4 === 3;
    return day <= (isLeapYear ? 6 : 5);
  }

  return day <= 30;
}

/**
 * Convert Gregorian time to Ethiopian time
 * Ethiopian time starts at 6:00 AM GMT = 0:00 Ethiopian
 * @param date - JavaScript Date object
 * @returns Ethiopian time object
 */
export function gregorianToEthiopianTime(date: Date): EthiopianTime {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Ethiopian time is 6 hours behind GMT
  // 6:00 AM GMT = 0:00 Ethiopian (start of day)
  // 12:00 PM GMT = 6:00 Ethiopian
  // 6:00 PM GMT = 12:00 Ethiopian (start of night)

  let ethHour = hours - 6;
  let period: 'day' | 'night' = 'day';

  if (ethHour < 0) {
    ethHour += 12;
    period = 'night';
  } else if (ethHour >= 12) {
    ethHour -= 12;
    period = 'night';
  } else {
    period = 'day';
  }

  // Handle 0 hour case (should be 12)
  if (ethHour === 0) ethHour = 12;

  return {
    hour: ethHour,
    minute: minutes,
    period
  };
}

/**
 * Convert Ethiopian time to Gregorian time
 * @param ethTime - Ethiopian time object
 * @returns Object with hours and minutes in GMT
 */
export function ethiopianTimeToGregorian(ethTime: EthiopianTime): { hours: number; minutes: number } {
  let gregHour = ethTime.hour + 6;

  // If it's night period, add 12 hours (or we're in early morning GMT)
  if (ethTime.period === 'night' && ethTime.hour >= 1 && ethTime.hour <= 5) {
    gregHour = ethTime.hour + 6; // 1-5 Ethiopian night = 7-11 PM GMT
  } else if (ethTime.period === 'night') {
    gregHour = ethTime.hour - 6; // 6-12 Ethiopian night = 0-6 AM GMT
    if (gregHour < 0) gregHour += 24;
  }

  // Handle 12 Ethiopian hour
  if (ethTime.hour === 12) {
    gregHour = ethTime.period === 'day' ? 18 : 6; // 12 day = 6 PM, 12 night = 6 AM
  }

  // Adjust for period
  if (ethTime.period === 'night' && ethTime.hour >= 1 && ethTime.hour <= 11) {
    gregHour = ethTime.hour + 18; // Ethiopian 1-11 night = GMT 19-29 (or 19-23, 0-5)
    if (gregHour >= 24) gregHour -= 24;
  }

  return {
    hours: gregHour,
    minutes: ethTime.minute
  };
}

/**
 * Convert Date to full Ethiopian DateTime
 */
export function gregorianToEthiopianDateTime(date: Date): EthiopianDateTime {
  const ethDate = gregorianToEthiopian(date);
  const ethTime = gregorianToEthiopianTime(date);

  return {
    ...ethDate,
    ...ethTime
  };
}

/**
 * Format Ethiopian time as string
 */
export function formatEthiopianTime(ethTime: EthiopianTime, format: 'short' | 'long' = 'short'): string {
  const hour = ethTime.hour === 0 ? 12 : ethTime.hour;
  const minute = String(ethTime.minute).padStart(2, '0');
  const periodAmharic = ethTime.period === 'day' ? 'ቀትር' : 'ማታ';

  if (format === 'long') {
    const periodLabel = ethTime.period === 'day' ? 'Day' : 'Night';
    return `${hour}:${minute} ${periodLabel} (Ethiopian)`;
  }

  return `${hour}:${minute} ${periodAmharic}`;
}

/**
 * Format Ethiopian DateTime as string
 */
export function formatEthiopianDateTime(ethDateTime: EthiopianDateTime, format: 'short' | 'long' = 'short'): string {
  const dateStr = formatEthiopianDate(ethDateTime, format);
  const timeStr = formatEthiopianTime(ethDateTime, format === 'long' ? 'long' : 'short');

  if (format === 'long') {
    return `${dateStr} at ${timeStr}`;
  }

  return `${dateStr} ${timeStr}`;
}

/**
 * Get Ethiopian day of week (0 = Sunday/Ehud)
 */
export function getEthiopianDayOfWeek(date: Date): number {
  return date.getDay(); // Same as Gregorian
}

/**
 * Get Ethiopian weekday name
 */
export function getEthiopianWeekdayName(date: Date, format: 'full' | 'short' = 'full'): string {
  const dayIndex = date.getDay();
  return format === 'full' ? ETHIOPIAN_WEEKDAYS[dayIndex] : ETHIOPIAN_WEEKDAYS_SHORT[dayIndex];
}

/**
 * Format relative time in Amharic context
 * Returns Ethiopian-formatted relative time
 */
export function formatEthiopianRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Get Ethiopian date info
  const ethDate = gregorianToEthiopian(then);
  const ethTime = gregorianToEthiopianTime(then);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} min${diffMin !== 1 ? 's' : ''} ago`;
  } else if (diffHour < 12) {
    return `${diffHour} hr${diffHour !== 1 ? 's' : ''} ago`;
  } else if (diffDay === 0) {
    // Today - show Ethiopian time
    return `Today at ${formatEthiopianTime(ethTime, 'short')}`;
  } else if (diffDay === 1) {
    return `Yesterday`;
  } else if (diffDay < 7) {
    return `${diffDay} days ago`;
  } else if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  } else {
    // Show Ethiopian date for older dates
    return formatEthiopianDate(ethDate, 'short');
  }
}

/**
 * Format timestamp for display (combines Ethiopian date and time)
 */
export function formatEthiopianTimestamp(date: Date | string, options?: {
  showDate?: boolean;
  showTime?: boolean;
  showRelative?: boolean;
}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const showDate = options?.showDate ?? true;
  const showTime = options?.showTime ?? true;
  const showRelative = options?.showRelative ?? false;

  if (showRelative) {
    return formatEthiopianRelativeTime(d);
  }

  const ethDate = gregorianToEthiopian(d);
  const ethTime = gregorianToEthiopianTime(d);

  const parts: string[] = [];

  if (showDate) {
    parts.push(formatEthiopianDate(ethDate, 'short'));
  }

  if (showTime) {
    parts.push(formatEthiopianTime(ethTime, 'short'));
  }

  return parts.join(' ');
}

/**
 * Get current Ethiopian date and time
 */
export function getCurrentEthiopianDateTime(): EthiopianDateTime {
  return gregorianToEthiopianDateTime(new Date());
}

/**
 * Get Ethiopian month name
 */
export function getEthiopianMonthName(month: number, format: 'full' | 'short' = 'full'): string {
  if (month < 1 || month > 13) return '';
  return format === 'full'
    ? ETHIOPIAN_MONTHS[month - 1]
    : ETHIOPIAN_MONTHS_SHORT[month - 1];
}

/**
 * Parse Ethiopian time string (e.g., "3:30 ቀትር" or "9:00 ማታ")
 */
export function parseEthiopianTime(timeStr: string): EthiopianTime | null {
  // Match patterns like "3:30 ቀትር", "9:00 ማታ", "12:30 day", "3:00"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(ቀትር|ማታ|day|night)?$/i);

  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const periodStr = (match[3] || '').toLowerCase();

  // Validate
  if (hour < 1 || hour > 12) return null;
  if (minute < 0 || minute > 59) return null;

  // Determine period
  let period: 'day' | 'night' = 'day';
  if (periodStr === 'ማታ' || periodStr === 'night') {
    period = 'night';
  }

  return { hour, minute, period };
}

/**
 * Create Ethiopian date picker values for dropdowns
 */
export function getEthiopianDateOptions() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const months = ETHIOPIAN_MONTHS.map((name, i) => ({ value: i + 1, label: name }));
  const currentEthYear = gregorianToEthiopian(new Date()).year;
  const years = Array.from({ length: 100 }, (_, i) => currentEthYear - 50 + i);

  return { days, months, years };
}

/**
 * Create Ethiopian time picker values for dropdowns
 */
export function getEthiopianTimeOptions() {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const periods: Array<{ value: 'day' | 'night'; label: string; amharic: string }> = [
    { value: 'day', label: 'Day (Morning/Afternoon)', amharic: 'ቀትር' },
    { value: 'night', label: 'Night (Evening)', amharic: 'ማታ' }
  ];

  return { hours, minutes, periods };
}
