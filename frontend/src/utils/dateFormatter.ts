/**
 * Date formatting utilities
 * Converts ISO date strings to human-readable formats
 */

/**
 * Format date to relative time (e.g., "2 hours ago", "yesterday")
 */
export const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Less than a minute
  if (diffInSeconds < 60) {
    return 'Just now';
  }

  // Less than an hour
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than a day
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  // Less than a week
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    if (diffInDays === 1) {
      return 'Yesterday';
    }
    return `${diffInDays} days ago`;
  }

  // Less than a month
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  // Less than a year
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  // More than a year - show full date
  return formatDate(dateString);
};

/**
 * Format date to readable format (e.g., "Jan 27, 2026")
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return dateString; // Return original if invalid
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  return date.toLocaleDateString('en-US', options);
};

/**
 * Format date with time (e.g., "Jan 27, 2026 at 8:30 PM")
 */
export const formatDateTime = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return dateString;
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  return date.toLocaleDateString('en-US', options);
};

/**
 * Format date to short format (e.g., "01/27/2026")
 */
export const formatShortDate = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return dateString;
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  return date.toLocaleDateString('en-US', options);
};

/**
 * Smart date formatter - uses relative time for recent dates, full date for older ones
 */
export const formatSmartDate = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  // Use relative time for dates within the last 7 days
  if (diffInDays < 7) {
    return formatRelativeTime(dateString);
  }

  // Use full date for older dates
  return formatDate(dateString);
};
