import type { Slot } from '../types';

const DAY_ORDER: Record<Slot['day'], number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Short weekday names in the `Groups` namespace, per locale (`Mon` → `пн`). */
export const WEEKDAY_SHORT_KEYS = {
  Mon: 'timetable.weekdayShort.mon',
  Tue: 'timetable.weekdayShort.tue',
  Wed: 'timetable.weekdayShort.wed',
  Thu: 'timetable.weekdayShort.thu',
  Fri: 'timetable.weekdayShort.fri',
  Sat: 'timetable.weekdayShort.sat',
  Sun: 'timetable.weekdayShort.sun',
} as const satisfies Record<Slot['day'], string>;

/**
 * "пн/пт 18:00–19:30": the group's days in week order and the first slot's times.
 * The end time matters as much as the start for "can I be somewhere else after this":
 * a bare start hides whether two groups' slots actually clash. Day names come from the
 * caller's translator, so the summary is never in the data layer's language.
 */
export function scheduleSummaryOf(slots: Slot[], dayLabel: (day: Slot['day']) => string): string {
  if (slots.length === 0) return '—';
  const sorted = [...slots].sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day]);
  const days = [...new Set(sorted.map((s) => s.day))].map(dayLabel).join('/');
  const first = sorted[0];
  return first ? `${days} ${first.start}–${first.end}` : days;
}
