import { http, HttpResponse } from 'msw';

import { MOCK_SCHOOLS } from '@/app/api/discovery/schools/route';
import { MOCK_NOTIFICATIONS } from '@/app/api/notifications/route';
import { MOCK_UPCOMING } from '@/app/api/student/upcoming/route';
import { MOCK_STREAK } from '@/app/api/student/streak/route';
import type { SchoolsResponse } from '@/features/discovery/types';
import type { EnrollmentRequestsResponse } from '@/features/enrollment/types';
import type { NotificationsResponse } from '@/features/notifications/types';
import type { ContainerProgress } from '@/features/student/types';

/**
 * Default handlers shared across tests, dev, and Storybook.
 * Feature-specific handlers live next to their features and are
 * appended via `server.use(...)` / `worker.use(...)`.
 */
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true })),

  http.get('/api/discovery/schools', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const language = url.searchParams.get('language');
    const level = url.searchParams.get('level');
    const type = url.searchParams.get('type');

    let results = MOCK_SCHOOLS;
    if (search)
      results = results.filter(
        (s) => s.name.toLowerCase().includes(search) || s.description?.toLowerCase().includes(search),
      );
    if (language) results = results.filter((s) => s.targetLanguages.includes(language));
    if (level) results = results.filter((s) => s.levels.includes(level as never));
    if (type) results = results.filter((s) => s.type === type);

    const response: SchoolsResponse = {
      items: results,
      pageInfo: { hasNextPage: false, total: results.length },
    };
    return HttpResponse.json(response);
  }),

  // Enrollment requests — real backend; default to empty list in tests.
  http.get('/api/enrollment/requests', () =>
    HttpResponse.json({ items: [] } as EnrollmentRequestsResponse),
  ),
  http.post('/api/enrollment/requests', () =>
    HttpResponse.json(
      { id: 'req-test', schoolId: 'school-1', schoolName: 'Test School', schoolType: 'school', status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { status: 201 },
    ),
  ),

  // Course enrollments
  http.get('/api/enrollment', () => HttpResponse.json({ items: [] })),
  http.post('/api/enrollment', () => HttpResponse.json({ id: 'enroll-test' }, { status: 201 })),
  http.delete('/api/enrollment/:id', () => new HttpResponse(null, { status: 204 })),
  http.patch('/api/enrollment/:id/complete', () => HttpResponse.json({ id: 'enroll-test', status: 'completed' })),

  // Progress — real backend; default to empty in tests.
  http.get('/api/student/progress', () => HttpResponse.json([] as ContainerProgress[])),

  // Attempt routes for tests — feature-specific tests override these.
  http.post('/api/content/exercises/:id/attempts', () =>
    HttpResponse.json({ attemptId: 'test-attempt-id', exerciseId: 'test-id', startedAt: new Date().toISOString() }, { status: 201 }),
  ),
  http.post('/api/content/exercises/:id/attempts/:attemptId/submit', () =>
    HttpResponse.json({ verdict: 'correct' }),
  ),
  http.post('/api/student/progress/events', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/student/upcoming', () => HttpResponse.json(MOCK_UPCOMING)),
  http.get('/api/student/streak', () => HttpResponse.json(MOCK_STREAK)),

  http.get('/api/notifications', () => {
    const unreadCount = MOCK_NOTIFICATIONS.filter((n) => n.readAt === null).length;
    const response: NotificationsResponse = { items: MOCK_NOTIFICATIONS, unreadCount };
    return HttpResponse.json(response);
  }),
];
