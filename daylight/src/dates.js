/**
 * Daylight — Date Utilities
 * All dates are local calendar safe. Never uses new Date("YYYY-MM-DD")
 * which causes timezone offset bugs across boundaries.
 */

export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Verify real calendar day
  const testDate = new Date(y, m - 1, d);
  return (
    testDate.getFullYear() === y &&
    testDate.getMonth() === m - 1 &&
    testDate.getDate() === d
  );
}

export function parseLocalDate(str) {
  if (!isValidDateString(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDateReadable(str, options = {}) {
  const d = parseLocalDate(str);
  if (!d) return str || '';
  return d.toLocaleDateString(undefined, {
    weekday: options.weekday,
    month: options.month || 'short',
    day: 'numeric',
    year: options.year !== false ? 'numeric' : undefined
  });
}

export function getDayOfWeek(str) {
  const d = parseLocalDate(str);
  return d ? d.getDay() : 0;
}

export function addDays(str, days) {
  const d = parseLocalDate(str) || new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}
