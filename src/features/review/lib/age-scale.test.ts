import { describe, expect, it } from 'vitest';

import { ageRail, ageTextTone, ageTone, hoursSince, isOverdue, ratio } from './age-scale';

const SLA = 24;

describe('ratio', () => {
  it('is zero for a submission made just now', () => {
    expect(ratio(0, SLA)).toBe(0);
  });

  it('is one exactly at the promised response time', () => {
    expect(ratio(SLA, SLA)).toBe(1);
  });

  it('saturates at two, so five days and nine days read the same', () => {
    expect(ratio(2 * SLA, SLA)).toBe(2);
    expect(ratio(5 * SLA, SLA)).toBe(2);
    expect(ratio(2 * SLA, SLA)).toBe(ratio(5 * SLA, SLA));
  });

  it('reads a missing promise as fresh rather than as infinitely late', () => {
    expect(ratio(100, 0)).toBe(0);
    expect(ratio(100, -1)).toBe(0);
    expect(ratio(Number.NaN, SLA)).toBe(0);
  });
});

describe('ageTone', () => {
  it('walks the three anchors of DATA_MODEL §5', () => {
    expect(ageTone(0, SLA)).toBe('oklch(0.685 0.012 102)');
    expect(ageTone(SLA, SLA)).toBe('oklch(0.638 0.073 82)');
    expect(ageTone(2 * SLA, SLA)).toBe('oklch(0.590 0.127 22)');
  });

  it('stops changing past twice the promise', () => {
    expect(ageTone(5 * SLA, SLA)).toBe(ageTone(2 * SLA, SLA));
  });
});

describe('ageTextTone', () => {
  it('keeps the hue of the rail and only changes how light it is rendered', () => {
    expect(ageTextTone(2 * SLA, SLA)).toEqual({
      light: 'oklch(0.450 0.127 22)',
      dark: 'oklch(0.800 0.127 22)',
    });
    expect(ageTone(2 * SLA, SLA)).toBe('oklch(0.590 0.127 22)');
  });
});

describe('ageRail', () => {
  it('runs from 3 px fresh to 6 px at twice the promise', () => {
    expect(ageRail(0, SLA)).toBe(3);
    expect(ageRail(SLA, SLA)).toBe(4.5);
    expect(ageRail(2 * SLA, SLA)).toBe(6);
    expect(ageRail(5 * SLA, SLA)).toBe(6);
  });
});

describe('isOverdue', () => {
  it('is false at the promise and true past it', () => {
    expect(isOverdue(SLA, SLA)).toBe(false);
    expect(isOverdue(SLA + 0.1, SLA)).toBe(true);
  });

  it('is false when no promise was made', () => {
    expect(isOverdue(500, 0)).toBe(false);
  });
});

describe('hoursSince', () => {
  const now = new Date('2026-08-18T12:00:00Z');

  it('counts hours from an ISO string', () => {
    expect(hoursSince('2026-08-18T09:00:00Z', now)).toBe(3);
  });

  it('never goes negative on a clock that disagrees with the server', () => {
    expect(hoursSince('2026-08-18T13:00:00Z', now)).toBe(0);
  });
});
