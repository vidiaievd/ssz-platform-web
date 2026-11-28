import type { SchoolGroupFacts, SchoolSessionItem, Unavailable } from '@/lib/dashboard/types';

import type { TodaysClass, WidgetData } from '../types';


/**
 * «Today's classes» from the school's sessions of the day and the school's groups
 * (organization-service).
 *
 * A cancelled session is left out — the card lists what is on, and the group's log is where
 * a called-off lesson is shown. Names and head counts come from the groups list rather than
 * a lookup per row; a session of a group that list lacks still shows, unnamed, so a lesson
 * never drops off the day.
 *
 * Nothing is marked "now": a school carries no time zone, and a wall-clock time read on the
 * server's clock would put the mark an hour or two off.
 */
export function buildTodaysClasses(
  sessions: SchoolSessionItem[] | Unavailable,
  groups: SchoolGroupFacts[],
): WidgetData<TodaysClass[]> {
  if (!Array.isArray(sessions)) return { status: 'unavailable' };

  const byId = new Map(groups.map((g) => [g.id, g]));
  const rows = sessions
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s): TodaysClass => {
      const group = byId.get(s.groupId);
      const room = s.room?.trim() ?? '';
      return {
        id: s.id,
        time: s.startTime,
        name: group?.name ?? null,
        room,
        mode: room ? 'in-person' : 'online',
        students: group?.studentCount ?? 0,
        cap: group && group.max > 0 ? group.max : null,
        status: 'upcoming',
      };
    });

  return rows.length > 0 ? { status: 'ok', data: rows } : { status: 'empty' };
}

/** Today as the platform's dates are kept: the UTC calendar day, `YYYY-MM-DD`. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
