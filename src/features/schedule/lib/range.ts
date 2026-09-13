/** A window of days, inclusive on both ends, as plain ISO dates. */
export interface DateRange {
  from: string;
  to: string;
}

export type RangeKind = 'week' | 'month';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for a date, read in UTC — the column the server stores is a date, not a moment. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC of an ISO day; `null` when the string is not one. */
export function parseDay(iso: string | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The week a day belongs to, Monday first.
 *
 * Monday rather than Sunday because every locale this product speaks — Norwegian,
 * Ukrainian, Russian and the English it shares with them — starts the week there, and a
 * teaching week starts with the first lesson of the week, not with the weekend.
 */
export function weekOf(day: Date): DateRange {
  const weekday = (day.getUTCDay() + 6) % 7; // Mon = 0
  const monday = new Date(day.getTime() - weekday * DAY_MS);
  return { from: isoDay(monday), to: isoDay(new Date(monday.getTime() + 6 * DAY_MS)) };
}

/** The calendar month a day belongs to, first to last. */
export function monthOf(day: Date): DateRange {
  const first = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const last = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
  return { from: isoDay(first), to: isoDay(last) };
}

export function rangeOf(kind: RangeKind, day: Date): DateRange {
  return kind === 'month' ? monthOf(day) : weekOf(day);
}

/** The day a step forward or back lands on — the anchor of the next range, not the range. */
export function shift(kind: RangeKind, day: Date, steps: number): Date {
  if (kind === 'week') return new Date(day.getTime() + steps * 7 * DAY_MS);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + steps, 1));
}

/** Every day of a range, in order. A week gives seven; a month gives its own length. */
export function daysOf(range: DateRange): string[] {
  const from = parseDay(range.from);
  const to = parseDay(range.to);
  if (!from || !to || to < from) return [];

  const days: string[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    days.push(isoDay(new Date(t)));
  }
  return days;
}

/** Groups anything dated into the days of a range, keeping empty days present. */
export function byDay<T extends { date: string }>(
  range: DateRange,
  items: readonly T[],
): Array<{ day: string; items: T[] }> {
  const buckets = new Map<string, T[]>(daysOf(range).map((day) => [day, []]));
  for (const item of items) {
    // A session outside the window is not this range's business; the server already
    // windowed, and a stray one would silently widen the screen's own claim.
    buckets.get(item.date)?.push(item);
  }
  return [...buckets.entries()].map(([day, items]) => ({ day, items }));
}
