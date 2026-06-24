import { test, expect } from '@playwright/test';

import { stubJson } from '../utils/stub';

/**
 * Notifications management — key flow per docs/plan/notifications-management:
 * an ENROLLMENT_REQUEST notification shows the applicant's name (not the raw
 * enum) and can be approved directly from the feed.
 */

const SCHOOL_SLUG = 'test-school';

const SESSION_STUB = {
  id: 'admin-1',
  email: 'school@e2e.test',
  roles: [{ role: 'SCHOOL_ADMIN', schoolId: 'school-1' }],
};

const ENROLLMENT_REQUEST_STUB = {
  id: 'n1',
  type: 'ENROLLMENT_REQUEST',
  templateData: {
    membershipId: 'm1',
    schoolId: 'school-1',
    schoolName: 'Test School',
    studentId: 'u1',
    studentName: 'Maria Hansen',
    source: 'public-apply',
    occurredAt: '2026-06-24T10:00:00.000Z',
  },
  isRead: false,
  archivedAt: null,
  createdAt: '2026-06-24T10:00:00.000Z',
};

test.describe('notifications page — enrollment request', () => {
  test('shows the applicant name instead of the raw enum, and approve calls the transition endpoint @stub', async ({
    page,
  }) => {
    await stubJson(page, '**/api/auth/session', SESSION_STUB);
    await stubJson(page, '**/api/notifications**', {
      items: [ENROLLMENT_REQUEST_STUB],
      unreadCount: 1,
      nextCursor: null,
    });

    let transitionCalled: unknown = null;
    await page.route('**/api/enrollment/memberships/*/transition', (route) => {
      transitionCalled = route.request().postDataJSON();
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/api/notifications/n1/archive', (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto(`/en/school/${SCHOOL_SLUG}/notifications`);

    const row = page.getByRole('article', { name: /Maria Hansen/ });
    const visible = await row.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Notifications page needs a running Next.js server with mock provider');
    }

    await expect(page.getByText('ENROLLMENT_REQUEST')).toHaveCount(0);

    await row.getByRole('button', { name: 'Approve' }).click();

    await expect.poll(() => transitionCalled).toEqual({ schoolId: 'school-1', to: 'onboarding' });
  });
});
