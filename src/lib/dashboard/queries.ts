import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import type {
  KpisPayload,
  AtRiskPayload,
  CourseHealthPayload,
  ActivityPayload,
  GroupsHealthPayload,
  GroupGapsPayload,
  TeacherLoadPayload,
  Unavailable,
} from './types';

type WidgetResult<T> = T | Unavailable;

async function safeWidgetFetch<T>(fn: () => Promise<T>): Promise<WidgetResult<T>> {
  try {
    return await fn();
  } catch {
    return { status: 'unavailable' };
  }
}

export async function fetchDashboardKpis(schoolId: string): Promise<WidgetResult<KpisPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<KpisPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/kpis`,
    }),
  );
}

/**
 * Every group of the school, taught against taken away — the gap widget (plan 58, §D).
 *
 * One call for the whole widget: the numbers are the group Progress tab's own, and asking
 * per row would make a school of twenty groups twenty round trips for one screen.
 */
export async function fetchGroupGaps(schoolId: string): Promise<WidgetResult<GroupGapsPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<GroupGapsPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/group-gaps`,
    }),
  );
}

export async function fetchAtRisk(
  schoolId: string,
  limit = 3,
): Promise<WidgetResult<AtRiskPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<AtRiskPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/at-risk`,
      query: { limit },
    }),
  );
}

export async function fetchCourseHealth(schoolId: string): Promise<WidgetResult<CourseHealthPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<CourseHealthPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/courses/health`,
    }),
  );
}

export async function fetchActivity(
  schoolId: string,
  limit = 6,
  cursor?: string,
): Promise<WidgetResult<ActivityPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<ActivityPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/activity`,
      query: { limit, ...(cursor ? { cursor } : {}) },
    }),
  );
}

export async function fetchGroupsHealth(
  schoolId: string,
  role: string,
): Promise<WidgetResult<GroupsHealthPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<GroupsHealthPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/dashboard/groups-health`,
      query: { role },
    }),
  );
}

export async function fetchTeacherLoad(
  schoolId: string,
): Promise<WidgetResult<TeacherLoadPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<TeacherLoadPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/dashboard/teacher-load`,
    }),
  );
}
