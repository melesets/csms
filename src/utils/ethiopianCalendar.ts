/**
 * Ethiopian Calendar Utility
 * Converts between Gregorian and Ethiopian calendars
 * Ethiopian calendar is approximately 7-8 years behind Gregorian
 */

export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
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
export function formatEthiopianDate(ethDate: EthiopianDate, format: 'short' | 'long' = 'short'): string {
  const { year, month, day } = ethDate;
  
  if (format === 'long') {
    return `${ETHIOPIAN_MONTHS[month - 1]} ${day}, ${year}`;
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
