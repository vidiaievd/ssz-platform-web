import 'server-only';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { getGroupsForSelect } from '@/features/students/api/queries';
import { getGroupCourseOutline } from '@/features/groups/api/queries';
import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import type { Session } from '@/features/groups/types';
import type { ReviewBlockWindow } from '@/lib/scheduling/provider';
import type { DateRange } from '../lib/range';
import { queueForecast, type QueueForecast, type ReviewEffort } from '../lib/queue-forecast';

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

export interface MyReviewBlocks extends ReviewBlockWindow {
  /**
   * Set when the blocks could not be read. Read beside the lessons, not instead of them:
   * the week still shows what is taught, and says that the marking time is missing.
   */
  error: boolean;
}

/**
 * The signed-in teacher's time for marking held in this workspace (plan 81).
 *
 * The read spans every school they mark for; the screen is addressed by workspace, so —
 * as with lessons — another school's blocks are not this week's business.
 */
export async function getMyReviewBlocks(
  workspaceId: string,
  range: DateRange,
): Promise<MyReviewBlocks> {
  try {
    const window = await getSchedulingProvider().myReviewBlocks(range.from, range.to);
    const ids = new Set(
      window.blocks.filter((block) => block.schoolId === workspaceId).map((block) => block.id),
    );
    const mine = (id: string | undefined) => id !== undefined && ids.has(id);
    return {
      blocks: window.blocks.filter((block) => ids.has(block.id)),
      occurrences: window.occurrences.filter((o) => ids.has(o.blockId)),
      overlaps: window.overlaps.filter(
        (o) => mine(o.blockId) || mine(o.blockAId) || mine(o.blockBId),
      ),
      error: false,
    };
  } catch (err) {
    console.error('[schedule] getMyReviewBlocks failed:', err);
    return { blocks: [], occurrences: [], overlaps: [], error: true };
  }
}

/**
 * One teacher's time for marking in a school, as the school's timetable reads it (plan 81,
 * step 7). Unlike {@link getMyReviewBlocks} the read is the school's own, so nothing of
 * the teacher's other workspaces comes with it.
 */
export async function getTeacherReviewBlocks(
  schoolId: string,
  teacherId: string,
  range: DateRange,
): Promise<MyReviewBlocks> {
  try {
    const window = await getSchedulingProvider().schoolReviewBlocks(
      schoolId,
      range.from,
      range.to,
      teacherId,
    );
    return { ...window, error: false };
  } catch (err) {
    console.error('[schedule] getTeacherReviewBlocks failed:', err);
    return { blocks: [], occurrences: [], overlaps: [], error: true };
  }
}

/**
 * The signed-in teacher's queue against the marking time they hold for the rest of the
 * week (plan 81, step 8). Null when there is nothing to say — no work waiting in their
 * groups and no time held; `'failed'` when the queue could not be read, so the screen does
 * not mistake an outage for an empty queue.
 *
 * Two services beside the blocks already read: exercise-engine counts the school's queue by
 * group × template and names a norm for each template; organization-service says who
 * reviews each group now — the same rule the oversight screen attributes load by.
 */
export async function getMyQueueForecast(
  schoolId: string,
  blocks: MyReviewBlocks,
  window: { from: string; to: string },
): Promise<QueueForecast | 'failed' | null> {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) return null;

    const effort = await serverFetch<ReviewEffort>({
      service: 'exercises',
      path: '/internal/attempts/review/effort',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { schoolId },
    });

    const groupIds = [
      ...new Set(effort.pending.map((b) => b.groupId).filter((id): id is string => id !== null)),
    ];
    const reviewers =
      groupIds.length === 0
        ? { groups: [] }
        : await serverFetch<{ groups: { groupId: string; teachers: { userId: string }[] }[] }>({
            service: 'organization',
            path: '/internal/review/reviewers',
            method: 'POST',
            directBaseUrl: env.ORGANIZATION_SERVICE_INTERNAL_URL,
            headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
            anonymous: true,
            body: { groupIds, at: new Date().toISOString() },
          });

    const reviewersByGroup = new Map(
      reviewers.groups
        .filter((group) => group.teachers.some((teacher) => teacher.userId === user.userId))
        .map((group) => [group.groupId, group.teachers.length]),
    );

    const forecast = queueForecast({
      effort,
      reviewersByGroup,
      occurrences: blocks.occurrences,
      ...window,
    });
    return forecast.pending === 0 && forecast.hoursHeld === 0 ? null : forecast;
  } catch (err) {
    console.error('[schedule] getMyQueueForecast failed:', err);
    return 'failed';
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
