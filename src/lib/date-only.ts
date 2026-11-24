/**
 * v1.5.34: a due date is a calendar day ("2026-11-03"), not a moment in time.
 *
 * The server can only hand the invoice form a Date (that's the form's type),
 * and it builds one in UTC. The browser's date picker works in the browser's
 * own time zone. So:
 *   - server: dateOnlyToUtc("2026-11-03") gives UTC midnight of that day;
 *   - form, on load: utcToCalendarDate() turns it into local midnight of the
 *     same day, so the picker shows 3 November everywhere;
 *   - form, on save: calendarDateToDateOnly() reads the picked day in local
 *     time. toISOString() read it in UTC, which is the day before anywhere
 *     east of UTC (the UK in summer included).
 */

export function dateOnlyToUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function utcToCalendarDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function calendarDateToDateOnly(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
