/**
 * Dates of a session are calendar days, not moments: `2026-09-03` is the third
 * of September wherever the reader sits. Every formatter here reads them in UTC
 * for that reason — parsing them as local time moves a session a day west of
 * Greenwich, which is exactly the bug the generator had.
 */
function asUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function format(iso: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(asUtcDate(iso));
}

/** `3 Sep` — the log's date column and the span's ends. */
export function dayMonth(iso: string, locale: string): string {
  return format(iso, locale, { day: 'numeric', month: 'short' });
}

/** `Thu` — the second line of the log's date column. */
export function weekdayShort(iso: string, locale: string): string {
  return format(iso, locale, { weekday: 'short' });
}

/** `Thu 3 Sep` — how a single session is announced. */
export function weekdayDayMonth(iso: string, locale: string): string {
  return `${weekdayShort(iso, locale)} ${dayMonth(iso, locale)}`;
}
