import { getDate, getDay, lastDayOfMonth, getMonth, getYear, differenceInMonths, startOfMonth } from 'date-fns';
import type { Reminder } from '@/hooks/useReminders';

/**
 * Get the last business day (Mon-Fri) of a given month/year.
 */
function getLastBusinessDay(year: number, month: number): number {
  let d = getDate(lastDayOfMonth(new Date(year, month)));
  const date = new Date(year, month, d);
  while (getDay(date) === 0 || getDay(date) === 6) {
    d--;
    date.setDate(d);
  }
  return d;
}

/**
 * Check if the month interval matches (every N months from creation).
 */
function monthIntervalMatches(r: Reminder, date: Date): boolean {
  const months = r.recurrence_months ?? 1;
  if (months <= 1) return true;
  const createdDate = new Date(r.created_at);
  const diff = differenceInMonths(startOfMonth(date), startOfMonth(createdDate));
  return diff >= 0 && diff % months === 0;
}

/**
 * Check if a reminder matches a given date based on its recurrence pattern.
 */
export function reminderMatchesDate(r: Reminder, date: Date): boolean {
  const dayOfMonth = getDate(date);
  const dayOfWeek = getDay(date);

  if (r.recurrence_type === 'weekly') {
    return r.recurrence_day === dayOfWeek;
  }

  // For monthly types, check month interval
  if (!monthIntervalMatches(r, date)) return false;

  if (r.recurrence_type === 'monthly' && r.recurrence_day === dayOfMonth) {
    return true;
  }

  if (r.recurrence_type === 'last_business_day') {
    const lbd = getLastBusinessDay(getYear(date), getMonth(date));
    return dayOfMonth === lbd;
  }

  if (r.recurrence_type === 'monthly_weekday' && r.recurrence_day === dayOfWeek && r.recurrence_week != null) {
    if (r.recurrence_week === -1) {
      const lastDay = getDate(lastDayOfMonth(date));
      return dayOfMonth + 7 > lastDay;
    }
    const nth = r.recurrence_week;
    return dayOfMonth > (nth - 1) * 7 && dayOfMonth <= nth * 7;
  }

  return false;
}

/**
 * Get all reminders that match a specific date.
 */
export function getRemindersForDate(reminders: Reminder[], date: Date): Reminder[] {
  return reminders.filter((r) => reminderMatchesDate(r, date));
}

/**
 * Get reminders that match any date within the next N days (excluding today).
 */
export function getUpcomingReminders(reminders: Reminder[], days: number): { reminder: Reminder; date: Date }[] {
  const results: { reminder: Reminder; date: Date }[] = [];
  const today = new Date();
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    for (const r of reminders) {
      if (reminderMatchesDate(r, d)) {
        results.push({ reminder: r, date: d });
      }
    }
  }
  return results;
}
