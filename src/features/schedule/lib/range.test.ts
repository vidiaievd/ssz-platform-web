// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { byDay, daysOf, isoDay, monthOf, parseDay, rangeOf, shift, weekOf } from './range';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('the week a day belongs to', () => {
  it('starts on Monday and ends on Sunday', () => {
    // 2026-09-13 is a Sunday.
    expect(weekOf(day('2026-09-13'))).toEqual({ from: '2026-09-07', to: '2026-09-13' });
  });

  it('keeps a Monday in its own week rather than pushing it back', () => {
    expect(weekOf(day('2026-09-14'))).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('crosses a month boundary without losing days', () => {
    expect(daysOf(weekOf(day('2026-10-01')))).toHaveLength(7);
  });
});

describe('the month a day belongs to', () => {
  it('runs from the first to the last day', () => {
    expect(monthOf(day('2026-09-13'))).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('knows a February of a leap year', () => {
    expect(monthOf(day('2028-02-10')).to).toBe('2028-02-29');
  });
});

describe('stepping', () => {
  it('moves a week at a time', () => {
    expect(isoDay(shift('week', day('2026-09-14'), 1))).toBe('2026-09-21');
    expect(isoDay(shift('week', day('2026-09-14'), -1))).toBe('2026-09-07');
  });

  it('moves a month at a time, landing on the first — a month has no fixed length', () => {
    expect(isoDay(shift('month', day('2026-01-31'), 1))).toBe('2026-02-01');
    expect(isoDay(shift('month', day('2026-01-15'), -1))).toBe('2025-12-01');
  });

  it('rangeOf answers the week or the month of the same day', () => {
    expect(rangeOf('week', day('2026-09-13')).from).toBe('2026-09-07');
    expect(rangeOf('month', day('2026-09-13')).from).toBe('2026-09-01');
  });
});

describe('reading a day off the address bar', () => {
  it.each(['', undefined, 'today', '2026-9-1', '2026-13-40'])('refuses %s', (value) => {
    expect(parseDay(value as string | undefined)).toBeNull();
  });

  it('takes an ISO day as UTC midnight', () => {
    expect(parseDay('2026-09-14')?.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });
});

describe('grouping by day', () => {
  it('keeps a day with nothing on it, so the week does not collapse', () => {
    const grouped = byDay({ from: '2026-09-14', to: '2026-09-16' }, [
      { date: '2026-09-15', id: 'a' },
    ]);

    expect(grouped.map((d) => [d.day, d.items.length])).toEqual([
      ['2026-09-14', 0],
      ['2026-09-15', 1],
      ['2026-09-16', 0],
    ]);
  });

  it('drops anything outside the window rather than widening it', () => {
    const grouped = byDay({ from: '2026-09-14', to: '2026-09-15' }, [
      { date: '2026-09-20', id: 'a' },
    ]);

    expect(grouped.every((d) => d.items.length === 0)).toBe(true);
  });
});
