// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { ReviewBlockOccurrence } from '@/lib/scheduling/provider';
import { dayItems, overlappingSittings, sittingKey } from './day-items';

const lesson = (id: string, date: string, start: string) => ({ id, date, start });

const sitting = (blockId: string, date: string, start: string): ReviewBlockOccurrence => ({
  blockId,
  schoolId: 'school',
  teacherId: 'teacher',
  repeat: 'weekly',
  date,
  start,
  end: '23:00',
  note: null,
});

describe('a day of lessons and marking time', () => {
  it('reads in the order of the day, whichever kind comes first', () => {
    const items = dayItems(
      [lesson('l1', '2026-10-27', '18:00'), lesson('l2', '2026-10-27', '09:00')],
      [sitting('b1', '2026-10-27', '12:00')],
    );
    expect(items.map((i) => (i.kind === 'session' ? i.session.id : i.occurrence.blockId))).toEqual([
      'l2',
      'b1',
      'l1',
    ]);
  });

  it('puts the lesson first when both start together — the block is the one that moves', () => {
    const items = dayItems(
      [lesson('l1', '2026-10-27', '16:00')],
      [sitting('b1', '2026-10-27', '16:00')],
    );
    expect(items.map((i) => i.kind)).toEqual(['session', 'block']);
  });
});

describe('sittings that run into something', () => {
  it('marks only the day of the overlap, not every week of the series', () => {
    const marked = overlappingSittings([
      { kind: 'block_lesson', date: '2026-10-27', blockId: 'b1', lessonId: 'l1' },
    ]);
    expect(marked.has(sittingKey('b1', '2026-10-27'))).toBe(true);
    expect(marked.has(sittingKey('b1', '2026-11-03'))).toBe(false);
  });

  it('marks both blocks of a block-on-block overlap', () => {
    const marked = overlappingSittings([
      { kind: 'blocks', date: '2026-10-28', blockAId: 'a', blockBId: 'b' },
    ]);
    expect([...marked].sort()).toEqual([
      sittingKey('a', '2026-10-28'),
      sittingKey('b', '2026-10-28'),
    ]);
  });
});
