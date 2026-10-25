import type { ReviewBlock, ReviewBlockWindow } from '@/lib/scheduling/provider';

/** How far ahead the school's view of a teacher's marking time looks, in weeks. */
export const HELD_TIME_WEEKS = 4;

/** One rule as the school's view lists it, with what it means for the weeks ahead. */
export interface HeldBlock {
  block: ReviewBlock;
  /** Sittings of the rule in the weeks ahead. */
  sittings: number;
  /** Days in the weeks ahead on which a sitting runs into a lesson or another block. */
  overlapDays: number;
}

export interface HeldTime {
  /** Series first, by weekday then start; one-offs after, by day. */
  blocks: HeldBlock[];
  /** Hours held per week, averaged over the weeks ahead — a series with a skipped day counts less. */
  hoursPerWeek: number;
}

/**
 * A teacher's marking time read by the school (plan 81, step 7): the rules to edit, and how
 * much of the weeks ahead they actually hold.
 *
 * `window` is read from `from` over {@link HELD_TIME_WEEKS} weeks; nothing outside it is
 * counted, so a series that begins later is listed with no sittings rather than dropped.
 */
export function heldTime(window: ReviewBlockWindow, from: string): HeldTime {
  const end = addDays(from, HELD_TIME_WEEKS * 7 - 1);
  const inside = (date: string) => date >= from && date <= end;

  const sittings = new Map<string, number>();
  let minutes = 0;
  for (const occurrence of window.occurrences) {
    if (!inside(occurrence.date)) continue;
    sittings.set(occurrence.blockId, (sittings.get(occurrence.blockId) ?? 0) + 1);
    minutes += toMinutes(occurrence.end) - toMinutes(occurrence.start);
  }

  // A day counts once per rule, whatever it ran into: the question is "how often", not
  // "with how many things".
  const overlapDays = new Map<string, Set<string>>();
  for (const overlap of window.overlaps) {
    if (!inside(overlap.date)) continue;
    for (const id of [overlap.blockId, overlap.blockAId, overlap.blockBId]) {
      if (id === undefined) continue;
      const days = overlapDays.get(id) ?? new Set<string>();
      days.add(overlap.date);
      overlapDays.set(id, days);
    }
  }

  const blocks = [...window.blocks].sort(byRule).map((block) => ({
    block,
    sittings: sittings.get(block.id) ?? 0,
    overlapDays: overlapDays.get(block.id)?.size ?? 0,
  }));

  return { blocks, hoursPerWeek: Math.round((minutes / 60 / HELD_TIME_WEEKS) * 10) / 10 };
}

function byRule(a: ReviewBlock, b: ReviewBlock): number {
  if (a.repeat !== b.repeat) return a.repeat === 'weekly' ? -1 : 1;
  if (a.repeat === 'weekly') {
    const day = weekday(a.startsOn) - weekday(b.startsOn);
    if (day !== 0) return day;
  } else if (a.startsOn !== b.startsOn) {
    return a.startsOn < b.startsOn ? -1 : 1;
  }
  return a.start.localeCompare(b.start);
}

/** Monday = 0, as the weeks of this product start. */
function weekday(iso: string): number {
  return (new Date(`${iso}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}
