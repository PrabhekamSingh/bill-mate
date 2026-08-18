/**
 * Date Utilities
 * Date formatting and parsing for DD/MM/YYYY format
 */

/**
 * Format date as DD/MM/YYYY
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date as YYYY-MM-DD (for input[type=date])
 */
export function formatDateISO(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Parse DD/MM/YYYY to Date object
 */
export function parseDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get today's date as DD/MM/YYYY
 */
export function today() {
  return formatDate(new Date());
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO() {
  return formatDateISO(new Date());
}

/**
 * Get first day of current month as YYYY-MM-DD
 */
export function firstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return formatDateISO(d);
}

/**
 * Get last day of current month as YYYY-MM-DD
 */
export function lastDayOfMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return formatDateISO(d);
}

/**
 * Get first day of current year as YYYY-MM-DD
 */
export function firstDayOfYear() {
  const d = new Date();
  d.setMonth(0);
  d.setDate(1);
  return formatDateISO(d);
}

/**
 * Get last day of current year as YYYY-MM-DD
 */
export function lastDayOfYear() {
  const d = new Date();
  d.setMonth(11);
  d.setDate(31);
  return formatDateISO(d);
}

/**
 * Format date for display (DD MMM YYYY)
 */
export function formatDateLong(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-IN', options);
}

/**
 * Get month name from number (1-12)
 */
export function getMonthName(month) {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return names[month - 1] || '';
}

/**
 * Check if date is valid
 */
export function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Add days to a date
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Difference in days between two dates
 */
export function diffDays(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}