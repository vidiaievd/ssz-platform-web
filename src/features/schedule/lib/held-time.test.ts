// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { ReviewBlock, ReviewBlockOccurrence } from '@/lib/scheduling/provider';
import { heldTime } from './held-time';

const block = (
  id: string,
  repeat: ReviewBlock['repeat'],
  startsOn: string,
  start: string,
): ReviewBlock => ({
  id,
  schoolId: 'school',
  teacherId: 'teacher',
  repeat,
  startsOn,
  endsOn: repeat === 'one_off' ? startsOn : null,
  start,
  end: '23:00',
  note: null,
  skips: [],
});

const sitting = (
  blockId: string,
  date: string,
  start: string,
  end: string,
): ReviewBlockOccurrence => ({
  blockId,
  schoolId: 'school',
  teacherId: 'teacher',
  repeat: 'weekly',
  date,
  start,
  end,
  note: null,
});

// 2026-10-26 is a Monday; four weeks run to 2026-11-22.
const FROM = '2026-10-26';

describe("a teacher's marking time read by the school", () => {
  it('averages the held hours over the four weeks ahead, ignoring sittings past them', () => {
    const held = heldTime(
      {
        blocks: [block('b1', 'weekly', '2026-10-29', '16:00')],
        occurrences: [
          sitting('b1', '2026-10-29', '16:00', '17:30'),
          sitting('b1', '2026-11-05', '16:00', '17:30'),
          // the 12th taken out of the series
          sitting('b1', '2026-11-19', '16:00', '17:30'),
          sitting('b1', '2026-11-26', '16:00', '17:30'),
        ],
        overlaps: [],
      },
      FROM,
    );

    expect(held.hoursPerWeek).toBe(1.1);
    expect(held.blocks[0]?.sittings).toBe(3);
  });

  it('counts a day once per rule, whatever the sitting ran into', () => {
    const held = heldTime(
      {
        blocks: [
          block('b1', 'weekly', '2026-10-29', '16:00'),
          block('b2', 'one_off', '2026-10-29', '16:30'),
        ],
        occurrences: [],
        overlaps: [
          { kind: 'block_lesson', date: '2026-10-29', blockId: 'b1', lessonId: 'l1' },
          { kind: 'blocks', date: '2026-10-29', blockAId: 'b1', blockBId: 'b2' },
          { kind: 'block_lesson', date: '2026-11-05', blockId: 'b1', lessonId: 'l2' },
          { kind: 'block_lesson', date: '2026-12-03', blockId: 'b1', lessonId: 'l3' },
        ],
      },
      FROM,
    );

    expect(held.blocks.map((b) => [b.block.id, b.overlapDays])).toEqual([
      ['b1', 2],
      ['b2', 1],
    ]);
  });

  it('lists series by weekday and start, then one-offs by day', () => {
    const held = heldTime(
      {
        blocks: [
          block('once-late', 'one_off', '2026-11-10', '09:00'),
          block('thu', 'weekly', '2026-10-29', '16:00'),
          block('once-early', 'one_off', '2026-11-03', '18:00'),
          block('mon-late', 'weekly', '2026-11-02', '18:00'),
          block('mon-early', 'weekly', '2026-10-26', '08:00'),
        ],
        occurrences: [],
        overlaps: [],
      },
      FROM,
    );

    expect(held.blocks.map((b) => b.block.id)).toEqual([
      'mon-early',
      'mon-late',
      'thu',
      'once-early',
      'once-late',
    ]);
    expect(held.hoursPerWeek).toBe(0);
  });
});
