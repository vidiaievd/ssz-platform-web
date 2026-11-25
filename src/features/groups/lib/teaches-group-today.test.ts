import { describe, expect, it } from 'vitest';
import { teachesGroupToday } from './teaches-group-today';

const now = new Date('2026-11-25T10:00:00Z');

describe('teachesGroupToday', () => {
  it('counts an open-ended assignment', () => {
    expect(teachesGroupToday({}, now)).toBe(true);
    expect(teachesGroupToday({ to: null }, now)).toBe(true);
  });

  it('counts an assignment that ends today or later', () => {
    expect(teachesGroupToday({ to: '2026-11-25' }, now)).toBe(true);
    expect(teachesGroupToday({ to: '2026-11-25T00:00:00.000Z' }, now)).toBe(true);
    expect(teachesGroupToday({ to: '2026-12-01' }, now)).toBe(true);
  });

  it('drops an assignment that ended before today', () => {
    expect(teachesGroupToday({ to: '2026-11-24' }, now)).toBe(false);
    expect(teachesGroupToday({ to: '2026-11-24T00:00:00.000Z' }, now)).toBe(false);
  });
});
