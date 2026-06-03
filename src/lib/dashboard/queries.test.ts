// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';

import {
  fetchDashboardKpis,
  fetchAtRisk,
  fetchCourseHealth,
  fetchActivity,
} from './queries';
import type { KpisPayload, AtRiskPayload, CourseHealthPayload, ActivityPayload } from './types';

// serverFetch builds: ANALYTICS_SERVICE_URL + /api/v1 + path
// → http://analytics.test/api/v1/schools/<id>/dashboard/kpis

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

const MOCK_KPIS: KpisPayload = {
  role: 'OWNER',
  kpis: [
    { key: 'active_students_7d', label: 'Active students · 7d', value: 42, hint: 'of 50 enrolled' },
    { key: 'lessons_completed_7d', label: 'Lessons completed · 7d', value: 120 },
    { key: 'pending_reviews', label: 'Pending reviews', value: 3 },
    { key: 'at_risk', label: 'At-risk students', value: 5 },
  ],
};

const MOCK_AT_RISK: AtRiskPayload = {
  students: [
    { userId: 'u1', name: 'Alice', course: 'Spanish A1', lastSeen: null, progress: 0.1 },
  ],
  total: 1,
};

const MOCK_COURSE_HEALTH: CourseHealthPayload = {
  courses: [
    { courseId: 'c1', name: 'Spanish A1', lang: 'es', enrollment: 30, completion: 0.6, trend: 'up' },
  ],
};

const MOCK_ACTIVITY: ActivityPayload = {
  items: [
    { id: 'a1', who: 'Bob', what: 'enrolled in', target: 'Spanish A1', occurredAt: '2026-06-01T10:00:00Z', tag: 'people' },
  ],
  nextCursor: null,
};

describe('fetchDashboardKpis', () => {
  it('returns KPI payload on 200', async () => {
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/dashboard/kpis`, () =>
        HttpResponse.json(MOCK_KPIS),
      ),
    );
    const result = await fetchDashboardKpis(SCHOOL_ID);
    expect(result).toEqual(MOCK_KPIS);
  });

  it('returns { status: unavailable } when analytics service is down', async () => {
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/dashboard/kpis`, () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    const result = await fetchDashboardKpis(SCHOOL_ID);
    expect(result).toEqual({ status: 'unavailable' });
  });
});

describe('fetchAtRisk', () => {
  it('returns at-risk payload on 200', async () => {
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/dashboard/at-risk`, () =>
        HttpResponse.json(MOCK_AT_RISK),
      ),
    );
    const result = await fetchAtRisk(SCHOOL_ID);
    expect(result).toEqual(MOCK_AT_RISK);
  });

  it('returns { status: unavailable } on 403 (teacher role)', async () => {
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/dashboard/at-risk`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    const result = await fetchAtRisk(SCHOOL_ID);
    expect(result).toEqual({ status: 'unavailable' });
  });
});

describe('fetchCourseHealth', () => {
  it('returns course health on 200', async () => {
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/dashboard/courses/health`, () =>
        HttpResponse.json(MOCK_COURSE_HEALTH),
      ),
    );
    const result = await fetchCourseHealth(SCHOOL_ID);
    expect(result).toEqual(MOCK_COURSE_HEALTH);
  });
});

describe('fetchActivity', () => {
  it('returns activity feed on 200', async () => {
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/activity`, () =>
        HttpResponse.json(MOCK_ACTIVITY),
      ),
    );
    const result = await fetchActivity(SCHOOL_ID);
    expect(result).toEqual(MOCK_ACTIVITY);
  });

  it('forwards limit query param', async () => {
    let capturedLimit: string | null = null;
    server.use(
      http.get(`http://analytics.test/api/v1/schools/${SCHOOL_ID}/activity`, ({ request }) => {
        capturedLimit = new URL(request.url).searchParams.get('limit');
        return HttpResponse.json(MOCK_ACTIVITY);
      }),
    );
    await fetchActivity(SCHOOL_ID, 10);
    expect(capturedLimit).toBe('10');
  });
});
