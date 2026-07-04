import { describe, expect, it } from 'vitest';
import { formatNextLessonLabel, getNextLessonOccurrence, type WeeklySlot } from './next-lesson';

describe('getNextLessonOccurrence', () => {
  it('returns null for an empty schedule', () => {
    expect(getNextLessonOccurrence([])).toBeNull();
  });

  it('picks today’s slot when it has not started yet', () => {
    // Wed 2026-06-24 10:00 local
    const now = new Date(2026, 5, 24, 10, 0);
    const slots: WeeklySlot[] = [{ day: 'Wed', start: '18:00', end: '19:30' }];

    const next = getNextLessonOccurrence(slots, now);

    expect(next?.date).toBe('2026-06-24');
    expect(next?.startAt.getHours()).toBe(18);
  });

  it('rolls over to next week when today’s slot already started', () => {
    // Wed 2026-06-24 20:00 local — slot started at 18:00
    const now = new Date(2026, 5, 24, 20, 0);
    const slots: WeeklySlot[] = [{ day: 'Wed', start: '18:00', end: '19:30' }];

    const next = getNextLessonOccurrence(slots, now);

    expect(next?.date).toBe('2026-07-01');
  });

  it('picks the earliest of several weekly slots', () => {
    // Mon 2026-06-22 09:00 local
    const now = new Date(2026, 5, 22, 9, 0);
    const slots: WeeklySlot[] = [
      { day: 'Fri', start: '18:00', end: '19:30' },
      { day: 'Mon', start: '18:00', end: '19:30' },
      { day: 'Wed', start: '08:00', end: '09:30' },
    ];

    const next = getNextLessonOccurrence(slots, now);

    expect(next).toMatchObject({ day: 'Mon', start: '18:00' });
  });
});

describe('formatNextLessonLabel', () => {
  it('renders a minutes-away label for an imminent lesson', () => {
    const now = new Date(2026, 5, 24, 17, 45);
    const occurrence = getNextLessonOccurrence([{ day: 'Wed', start: '18:00', end: '19:30' }], now)!;

    expect(formatNextLessonLabel(occurrence, 'en', now)).toBe('in 15 minutes');
  });

  it('renders an hours-away label between one and twenty-four hours out', () => {
    const now = new Date(2026, 5, 24, 10, 0);
    const occurrence = getNextLessonOccurrence([{ day: 'Wed', start: '18:00', end: '19:30' }], now)!;

    expect(formatNextLessonLabel(occurrence, 'en', now)).toBe('in 8 hours');
  });

  it('renders a weekday + date label more than a day out', () => {
    const now = new Date(2026, 5, 22, 9, 0); // Mon
    const occurrence = getNextLessonOccurrence([{ day: 'Fri', start: '18:00', end: '19:30' }], now)!;

    expect(formatNextLessonLabel(occurrence, 'en', now)).toContain('18:00–19:30');
  });
});
