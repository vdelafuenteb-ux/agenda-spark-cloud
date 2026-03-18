import { format, isToday, isBefore, isAfter, startOfDay, addDays } from 'date-fns';

export function parseStoredDate(value?: string | null) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toStoredDate(date?: Date | null) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatStoredDate(
  value: string | null | undefined,
  pattern: string,
  options?: Parameters<typeof format>[2],
) {
  const date = parseStoredDate(value);
  return date ? format(date, pattern, options) : '';
}

export function isStoredDateToday(value?: string | null) {
  const date = parseStoredDate(value);
  return date ? isToday(date) : false;
}

export function isStoredDateOverdue(value?: string | null) {
  const date = parseStoredDate(value);
  if (!date) return false;
  return isBefore(date, startOfDay(new Date()));
}

export function isStoredDateUpcoming(value?: string | null, days = 3) {
  const date = parseStoredDate(value);
  if (!date) return false;
  const today = startOfDay(new Date());
  const limit = addDays(today, days);
  return !isBefore(date, today) && !isAfter(date, limit);
}
