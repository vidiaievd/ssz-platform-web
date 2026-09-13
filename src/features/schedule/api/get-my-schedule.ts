import 'server-only';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { getGroupsForSelect } from '@/features/students/api/queries';
import { getGroupCourseOutline } from '@/features/groups/api/queries';
import { AppError } from '@/lib/errors';
import type { Session } from '@/features/groups/types';
import type { DateRange } from '../lib/range';

/** One session of the week, with the name the screen puts on it. */
export interface ScheduleSession extends Session {
  /**
   * Whom the lesson is with: the group's name, or — once a tutor teaches somebody one to
   * one — that learner's. The screen never says "group" for a workspace of one.
   */
  title: string;
  /** What it teaches, as the course names it; null while no topic is set. */
  topicTitle: string | null;
}

export interface MySchedule {
  sessions: ScheduleSession[];
  /** Set when the schedule could not be read at all, so the screen says so rather than showing an empty week. */
  error: string | null;
}

/**
 * The signed-in teacher's own sessions in one window, named.
 *
 * Two services, and the split is deliberate: scheduling knows when a session is and what
 * it teaches, organization-service knows what the group holding it is called. Asking the
 * second one per session would be a lookup per row, so the groups are fetched once and
 * joined here.
 *
 * Sessions of groups outside this workspace are dropped. A tutor may also teach at a
 * school, and the screen is addressed by workspace: showing a school's lessons on their
 * own workspace's schedule would answer a question nobody asked.
 */
export async function getMySchedule(
  workspaceId: string,
  range: DateRange,
): Promise<MySchedule> {
  const scheduling = getSchedulingProvider();

  try {
    const [sessions, groups] = await Promise.all([
      scheduling.mySessions(range.from, range.to),
      getGroupsForSelect(workspaceId),
    ]);

    const names = new Map(groups.map((group) => [group.id, group.name]));
    const mine = sessions.filter((session) => names.has(session.groupId));

    // One outline per course, not per session: a week is a handful of sessions over one or
    // two courses, and the titles they carry are the same ones the group's own log prints.
    const courseByGroup = new Map(groups.map((group) => [group.id, group.courseId]));
    const titles = await unitTitles(new Set(mine.map((s) => courseByGroup.get(s.groupId) ?? null)));

    return {
      sessions: mine.map((session) => ({
        ...session,
        title: names.get(session.groupId) ?? '',
        topicTitle: session.contentUnitId ? (titles.get(session.contentUnitId) ?? null) : null,
      })),
      error: null,
    };
  } catch (err) {
    if (err instanceof AppError && err.code === 'upstream_unavailable') {
      return { sessions: [], error: 'unavailable' };
    }
    console.error('[schedule] getMySchedule failed:', err);
    return { sessions: [], error: 'failed' };
  }
}

/** Unit titles of every course the window touches, keyed by course unit id. */
async function unitTitles(courseIds: Set<string | null>): Promise<Map<string, string>> {
  const titles = new Map<string, string>();

  await Promise.all(
    [...courseIds]
      .filter((id): id is string => id !== null && id !== '')
      .map(async (courseId) => {
        // The outline reader takes a group only to read its course off it; a bare course is
        // all it needs, and all we hold here.
        const outline = await getGroupCourseOutline({ courseId } as never);
        for (const unit of outline.units) titles.set(unit.id, unit.title);
      }),
  );

  return titles;
}
