import { test, expect } from '@playwright/test';

import { stubJson } from '../utils/stub';

/**
 * Critical flows for Group Management:
 * - Groups list renders and filter changes URL params
 * - Group detail page loads with tabs
 * - New group wizard: stepper progresses and Back/Continue work
 * - Timetable page loads teacher list
 *
 * All tests use @stub tag (no live backend required).
 * Full e2e flows (create group + assign teacher) require live backend seeds.
 */

const SCHOOL_SLUG = 'test-school';
const GROUP_ID    = 'group-a1';

const SESSION_STUB = {
  id: 'admin-1',
  email: 'admin@test.com',
  roles: [{ role: 'SCHOOL_ADMIN', schoolId: 'school-1' }],
};

const SCHOOL_STUB = {
  id: 'school-1',
  name: 'Test School',
  slug: SCHOOL_SLUG,
  ownerId: 'admin-1',
  avatarUrl: null,
  description: null,
};

async function stubAuth(page: import('@playwright/test').Page) {
  await stubJson(page, '**/api/auth/me', SESSION_STUB);
  await stubJson(page, '**/organizations/schools/by-slug/**', SCHOOL_STUB);
  await stubJson(page, '**/organizations/schools/*/members*', []);
}

// ── Groups list ───────────────────────────────────────────────────────────────

test.describe('Groups list', () => {
  test('page is protected — redirects to login when unauthenticated @stub', async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/groups`);
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });

  test('list page renders "New group" button when authenticated @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/groups`, []);
    await stubJson(page, `**/api/scheduling/**`, { slots: [] });

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups`);
    await expect(page.getByRole('link', { name: /new group/i })).toBeVisible({ timeout: 10_000 });
  });

  test('filter segment buttons update the URL @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/groups`, []);

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups`);
    await expect(page.getByRole('button', { name: /needs attention/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /needs attention/i }).click();
    await expect(page).toHaveURL(/segment=attention/);
  });
});

// ── Group detail ──────────────────────────────────────────────────────────────

test.describe('Group detail', () => {
  const GROUP_STUB = {
    id: GROUP_ID,
    name: 'English A1 Morning',
    courseId: null,
    lang: 'en',
    level: 'A1',
    status: 'ACTIVE',
    mode: 'online',
    minCapacity: 5,
    maxCapacity: 12,
    studentCount: 8,
    teachers: [{
      userId: 'teacher-x',
      name: 'Alex Teacher',
      role: 'PRIMARY',
      avatarUrl: null,
    }],
    startDate: null,
    endDate: null,
  };

  test('detail page renders group name in heading @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/groups/${GROUP_ID}`, GROUP_STUB);
    await stubJson(page, `**/organizations/schools/*/groups/${GROUP_ID}/members`, []);
    await stubJson(page, `**/organizations/schools/*/groups`, [GROUP_STUB]);

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/${GROUP_ID}`);
    await expect(page.getByRole('heading', { name: /English A1 Morning/i }))
      .toBeVisible({ timeout: 10_000 });
  });

  test('tabs are visible (Overview, Students, Teachers, Schedule) @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/groups/${GROUP_ID}`, GROUP_STUB);
    await stubJson(page, `**/organizations/schools/*/groups/${GROUP_ID}/members`, []);
    await stubJson(page, `**/organizations/schools/*/groups`, [GROUP_STUB]);

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/${GROUP_ID}`);
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible({ timeout: 10_000 });
    await expect(tablist.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(tablist.getByRole('tab', { name: /students/i })).toBeVisible();
    await expect(tablist.getByRole('tab', { name: /teachers/i })).toBeVisible();
    await expect(tablist.getByRole('tab', { name: /schedule/i })).toBeVisible();
  });

  test('clicking Teachers tab updates the URL param @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/groups/${GROUP_ID}`, GROUP_STUB);
    await stubJson(page, `**/organizations/schools/*/groups/${GROUP_ID}/members`, []);
    await stubJson(page, `**/organizations/schools/*/groups`, [GROUP_STUB]);

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/${GROUP_ID}`);
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible({ timeout: 10_000 });
    await tablist.getByRole('tab', { name: /teachers/i }).click();
    await expect(page).toHaveURL(/tab=teachers/);
  });
});

// ── New group wizard ──────────────────────────────────────────────────────────

test.describe('New group wizard', () => {
  test('wizard page renders stepper with Course as first step @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/members*`, []);
    await stubJson(page, '**/api/content/containers*', { items: [], total: 0, page: 1, pageSize: 20, counts: { all: 0, draft: 0, published: 0, archived: 0 } });

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/new`);
    await expect(page.getByRole('main').getByText(/new group/i)).toBeVisible({ timeout: 10_000 });

    // First step heading should be visible
    await expect(page.getByRole('heading', { name: /choose a course/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Continue button advances to Details step @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/members*`, []);
    await stubJson(page, '**/api/content/containers*', { items: [], total: 0, page: 1, pageSize: 20, counts: { all: 0, draft: 0, published: 0, archived: 0 } });

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/new`);
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible({ timeout: 10_000 });

    // Step 0 (Course) is always valid — clicking Continue advances to Details
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('heading', { name: /group details/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Continue is disabled on Details step until name is filled @stub', async ({ page }) => {
    await stubAuth(page);
    await stubJson(page, `**/organizations/schools/*/members*`, []);
    await stubJson(page, '**/api/content/containers*', { items: [], total: 0, page: 1, pageSize: 20, counts: { all: 0, draft: 0, published: 0, archived: 0 } });

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/new`);
    // Advance to Details
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('heading', { name: /group details/i })).toBeVisible({ timeout: 5_000 });

    const continueBtn = page.getByRole('button', { name: /continue/i });
    // Name field empty → Continue should be disabled
    await expect(continueBtn).toBeDisabled();

    // Fill in the name
    await page.getByRole('textbox', { name: /group name/i }).fill('Test Group Alpha');
    // Now Continue should be enabled
    await expect(continueBtn).toBeEnabled();
  });
});

// ── Timetable ─────────────────────────────────────────────────────────────────

test.describe('Teacher timetable', () => {
  test('timetable page is accessible at /groups/timetable @stub', async ({ page }) => {
    await stubAuth(page);
    // Stub timetable with mock teachers
    await stubJson(page, `**/organizations/schools/*/members*`, [
      { userId: 'teacher-x', name: 'Alex Teacher', role: 'TEACHER', maxWeeklyHours: 10, langs: ['en'] },
    ]);

    await page.goto(`/en/school/${SCHOOL_SLUG}/groups/timetable`);
    await expect(page.getByRole('heading', { name: /teacher timetable/i })).toBeVisible({ timeout: 10_000 });
  });
});
