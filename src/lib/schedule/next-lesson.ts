export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface WeeklySlot {
  day: Weekday;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface NextLessonOccurrence {
  day: Weekday;
  start: string;
  end: string;
  /** "YYYY-MM-DD" of the next occurrence, in the caller's local timezone. */
  date: string;
  /** The slot's start instant, in the caller's local timezone. */
  startAt: Date;
}

const WEEKDAY_ORDER: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * The earliest upcoming occurrence of a recurring weekly schedule, computed
 * against the caller's local clock — slots that already started today are
 * skipped in favor of next week's occurrence, so a "next lesson" is always
 * genuinely in the future.
 */
export function getNextLessonOccurrence(slots: WeeklySlot[], now: Date = new Date()): NextLessonOccurrence | null {
  if (!slots.length) return null;

  const todayIdx = (now.getDay() + 6) % 7; // Mon=0..Sun=6
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let best: { slot: WeeklySlot; daysAhead: number } | null = null;
  for (const slot of slots) {
    const slotIdx = WEEKDAY_ORDER.indexOf(slot.day);
    if (slotIdx === -1) continue;
    let daysAhead = (slotIdx - todayIdx + 7) % 7;
    if (daysAhead === 0 && slot.start <= nowHHMM) daysAhead = 7;
    if (!best || daysAhead < best.daysAhead) best = { slot, daysAhead };
  }
  if (!best) return null;

  const [hh = 0, mm = 0] = best.slot.start.split(':').map(Number);
  const startAt = new Date(now);
  startAt.setDate(startAt.getDate() + best.daysAhead);
  startAt.setHours(hh, mm, 0, 0);

  return { day: best.slot.day, start: best.slot.start, end: best.slot.end, date: toISODate(startAt), startAt };
}

const RELATIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * "In 12 minutes" close in, a weekday + date further out — both rendered via
 * `Intl` for the caller's locale, no translation keys needed.
 */
export function formatNextLessonLabel(occurrence: NextLessonOccurrence, locale: string, now: Date = new Date()): string {
  const diffMs = occurrence.startAt.getTime() - now.getTime();

  if (diffMs <= RELATIVE_THRESHOLD_MS) {
    const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffMinutes < 60) return rtf.format(diffMinutes, 'minute');
    return rtf.format(Math.round(diffMinutes / 60), 'hour');
  }

  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    occurrence.startAt,
  );
  return `${dateLabel}, ${occurrence.start}–${occurrence.end}`;
}
