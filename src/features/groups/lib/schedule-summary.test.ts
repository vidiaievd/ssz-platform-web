// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { scheduleSummaryOf, WEEKDAY_SHORT_KEYS } from './schedule-summary';
import uk from '../../../../messages/uk/Groups.json';

const ukDay = (day: keyof typeof WEEKDAY_SHORT_KEYS) =>
  uk.timetable.weekdayShort[WEEKDAY_SHORT_KEYS[day].split('.').pop() as keyof typeof uk.timetable.weekdayShort];

describe('scheduleSummaryOf', () => {
  it('lists the days in week order, once each, with the first slot times', () => {
    const slots = [
      { day: 'Fri' as const, start: '09:00', end: '11:30', room: '' },
      { day: 'Mon' as const, start: '09:00', end: '11:30', room: '' },
      { day: 'Wed' as const, start: '09:00', end: '11:30', room: '' },
      { day: 'Mon' as const, start: '14:00', end: '15:00', room: '' },
    ];
    expect(scheduleSummaryOf(slots, (d) => d)).toBe('Mon/Wed/Fri 09:00–11:30');
  });

  it('names the days in the reader language, not in English', () => {
    const slots = [
      { day: 'Mon' as const, start: '12:15', end: '13:45', room: '' },
      { day: 'Fri' as const, start: '12:15', end: '13:45', room: '' },
    ];
    expect(scheduleSummaryOf(slots, ukDay)).toBe('пн/пт 12:15–13:45');
  });

  it('is a dash without slots', () => {
    expect(scheduleSummaryOf([], (d) => d)).toBe('—');
  });
});
