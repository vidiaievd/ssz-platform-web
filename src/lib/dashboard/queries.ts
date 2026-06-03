import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { KpisPayload, AtRiskPayload, CourseHealthPayload, ActivityPayload, Unavailable } from './types';

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
      path: `/schools/${schoolId}/dashboard/kpis`,
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
      path: `/schools/${schoolId}/dashboard/at-risk`,
      query: { limit },
    }),
  );
}

export async function fetchCourseHealth(schoolId: string): Promise<WidgetResult<CourseHealthPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<CourseHealthPayload>({
      service: 'analytics',
      path: `/schools/${schoolId}/dashboard/courses/health`,
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
      path: `/schools/${schoolId}/activity`,
      query: { limit, ...(cursor ? { cursor } : {}) },
    }),
  );
}
