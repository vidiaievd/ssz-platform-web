import type { ReviewBlockOccurrence, ReviewBlockOverlap } from '@/lib/scheduling/provider';

/** The fields of a lesson the order of a day needs — a ScheduleSession has them all. */
interface DatedSession {
  id: string;
  date: string;
  start: string;
}

export type DayItem<S extends DatedSession> =
  | { kind: 'session'; date: string; start: string; session: S }
  | { kind: 'block'; date: string; start: string; occurrence: ReviewBlockOccurrence };

/**
 * Lessons and marking time of a window as one list in the order of the day.
 *
 * By start time, so a day reads top to bottom as it is lived; a lesson goes first on a
 * tie, because it is the fixed thing and the block is the one that can move.
 */
export function dayItems<S extends DatedSession>(
  sessions: readonly S[],
  occurrences: readonly ReviewBlockOccurrence[],
): Array<DayItem<S>> {
  const items: Array<DayItem<S>> = [
    ...sessions.map((session) => ({
      kind: 'session' as const,
      date: session.date,
      start: session.start,
      session,
    })),
    ...occurrences.map((occurrence) => ({
      kind: 'block' as const,
      date: occurrence.date,
      start: occurrence.start,
      occurrence,
    })),
  ];
  return items.sort(
    (a, b) =>
      a.start.localeCompare(b.start) || (a.kind === b.kind ? 0 : a.kind === 'session' ? -1 : 1),
  );
}

/** One sitting of a block: the block's id is shared by every week of a series. */
export function sittingKey(blockId: string, date: string): string {
  return `${blockId}:${date}`;
}

/**
 * The sittings that run into something, keyed by `sittingKey`.
 *
 * The day is part of the key: the series that runs into Tuesday's lesson leaves its
 * Thursday sitting clean. A block-on-block overlap marks both sides.
 */
export function overlappingSittings(overlaps: readonly ReviewBlockOverlap[]): Set<string> {
  return new Set(
    overlaps.flatMap((o) =>
      [o.blockId, o.blockAId, o.blockBId]
        .filter((id): id is string => id !== undefined)
        .map((id) => sittingKey(id, o.date)),
    ),
  );
}
