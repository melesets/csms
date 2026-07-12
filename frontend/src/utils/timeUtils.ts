// Time utilities - shift time calculation and formatting helpers
import { gregorianToEthiopian, gregorianToEthiopianTime, formatEthiopianDate, formatEthiopianTime } from './ethiopianCalendar';

// Apply UTC+3 offset for Ethiopia
const toEthiopianLocal = (date: Date): Date => {
    const d = new Date(date);
    d.setTime(d.getTime() + 3 * 3600 * 1000);
    return d;
};

// Utility function to convert date to relative time (e.g., "5 minutes ago")
export const getRelativeTime = (date: string | Date): string => {
    const now = new Date();
    const then = toEthiopianLocal(new Date(date));
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
};

/**
 * Get relative time with Ethiopian timestamp fallback
 * Shows relative time for recent dates, Ethiopian date for older dates
 */
export const getEthiopianRelativeTime = (date: string | Date): string => {
    const now = new Date();
    const then = toEthiopianLocal(new Date(date));
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    // For very recent times, use relative
    if (diffInSeconds < 60) {
        return 'just now';
    }

    if (diffInMinutes < 60) {
        return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    if (diffInHours < 12) {
        return `${diffInHours} hr${diffInHours !== 1 ? 's' : ''} ago`;
    }

    // For today, show "Today at X:XX"
    if (diffInDays === 0) {
        const ethTime = gregorianToEthiopianTime(then);
        return `Today at ${formatEthiopianTime(ethTime, 'short')}`;
    }

    // Yesterday
    if (diffInDays === 1) {
        return 'Yesterday';
    }

    // Within a week
    if (diffInDays < 7) {
        return `${diffInDays} days ago`;
    }

    // For older dates, use Ethiopian date
    const ethDate = gregorianToEthiopian(then);
    return formatEthiopianDate(ethDate, 'short');
};

/**
 * Format time in Ethiopian format with period indicator
 */
export const formatEthiopianTimeString = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const ethTime = gregorianToEthiopianTime(toEthiopianLocal(d));
    return formatEthiopianTime(ethTime, 'short');
};

/**
 * Format date and time together in Ethiopian format
 */
export const formatEthiopianDateTimeString = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const local = toEthiopianLocal(d);
    const ethDate = gregorianToEthiopian(local);
    const ethTime = gregorianToEthiopianTime(local);
    return `${formatEthiopianDate(ethDate, 'short')} ${formatEthiopianTime(ethTime, 'short')}`;
};

/**
 * Get shift name from time
 * Returns: Morning, Afternoon, or Night based on Ethiopian time
 */
export const getShiftFromTime = (date: Date | string): 'Morning' | 'Afternoon' | 'Night' => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const hour = toEthiopianLocal(d).getHours();

    // Ethiopian shifts:
    // Morning: 6:00 AM - 12:00 PM GMT (0:00 - 6:00 Ethiopian day)
    // Afternoon: 12:00 PM - 6:00 PM GMT (6:00 - 12:00 Ethiopian day)
    // Night: 6:00 PM - 6:00 AM GMT (Ethiopian night)
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    return 'Night';
};

/**
 * Get current Ethiopian shift
 */
export const getCurrentEthiopianShift = (): 'Morning' | 'Afternoon' | 'Night' => {
    return getShiftFromTime(new Date());
};
