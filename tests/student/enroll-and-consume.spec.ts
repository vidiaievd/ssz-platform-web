import { test, expect } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { LessonPage } from '../pages/lesson.page';
import { stubJson } from '../utils/stub';

/**
 * Critical flow: browse catalogue → request enrolment → school approves →
 * student opens lesson → completes lesson
 *
 * Hybrid strategy:
 * - Stub-tagged tests verify the UI surfaces without a backend.
 * - The full flow test requires the live backend with e2e seed data.
 *   Seed: student@e2e.test / E2eStudent1!, school@e2e.test / E2eSchool1!
 *   See tests/utils/seeds/README.md for setup instructions.
 */

const STUDENT = { email: 'student@e2e.test', password: 'E2eStudent1!' };
const SCHOOL_ADMIN = { email: 'school@e2e.test', password: 'E2eSchool1!' };
const SEEDED_CONTAINER_ID = 'e2e-test-container';
const SEEDED_LESSON_ID = 'e2e-test-lesson-1';

async function loginAs(loginPage: LoginPage, user: { email: string; password: string }) {
  await loginPage.goto();
  await loginPage.login(user.email, user.password);
}

test.describe('Enrol and consume flow', () => {
  test('unauthenticated user sees public catalogue @stub', async ({ page }) => {
    await stubJson(page, '**/api/content/containers**', {
      items: [
        {
          id: '1',
          title: 'Norwegian for Beginners',
          slug: 'norwegian-for-beginners',
          description: 'Learn the basics of Norwegian.',
          containerType: 'course',
          targetLanguage: 'nb',
          difficultyLevel: 'A1',
          visibility: 'public',
          accessTier: 'public_free',
          ownerUserId: 'owner-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pageInfo: { hasNextPage: false, total: 1 },
    });

    await page.goto('/en/catalogue');
    await expect(page.getByRole('heading', { name: /catalogue/i })).toBeVisible();
    await expect(page.getByText('Norwegian for Beginners')).toBeVisible();
  });

  test('student dashboard is protected — redirects to login when unauthenticated @stub', async ({
    page,
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectRedirectToLogin();
  });

  test('seeded student can view enrolled dashboard (live backend)', async ({ page }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const loginPage = new LoginPage(page);
    await loginAs(loginPage, STUDENT);

    await expect(page).toHaveURL(/\/student\/enrolled/, { timeout: 10000 });

    const dashboard = new DashboardPage(page);
    await dashboard.expectWelcomeGreeting();
  });

  test('seeded student can open a lesson (live backend)', async ({ page }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const loginPage = new LoginPage(page);
    await loginAs(loginPage, STUDENT);
    await expect(page).toHaveURL(/\/student\/enrolled/, { timeout: 10000 });

    const lessonPage = new LessonPage(page);
    await lessonPage.goto(SEEDED_LESSON_ID, SEEDED_CONTAINER_ID);
    await lessonPage.expectLessonLoaded();
  });

  test('seeded student can complete a lesson (live backend)', async ({ page }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const loginPage = new LoginPage(page);
    await loginAs(loginPage, STUDENT);

    const lessonPage = new LessonPage(page);
    await lessonPage.goto(SEEDED_LESSON_ID, SEEDED_CONTAINER_ID);
    await lessonPage.expectLessonLoaded();
    await lessonPage.complete();

    await expect(page.getByRole('status')).toContainText(/completed/i, { timeout: 5000 });
  });

  test('full enrol flow: apply → approve → onboarding → ready-to-place → admin places → schedule (live backend)', async ({
    browser,
  }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    // Two separate browser contexts simulate two different users simultaneously.
    const studentCtx = await browser.newContext();
    const adminCtx = await browser.newContext();

    const studentPage = await studentCtx.newPage();
    const adminPage = await adminCtx.newPage();

    try {
      // Student requests enrolment via catalogue → school detail page
      const studentLogin = new LoginPage(studentPage);
      await loginAs(studentLogin, STUDENT);
      await expect(studentPage).toHaveURL(/\/student\/enrolled/, { timeout: 10000 });

      await studentPage.goto('/en/catalogue/e2e-test-school');
      await studentPage.getByRole('button', { name: /request enrolment/i }).click();
      await studentPage.getByLabel(/level/i).selectOption('B1');
      await studentPage.getByRole('button', { name: /send request/i }).click();
      await expect(studentPage.getByText(/request sent/i)).toBeVisible({ timeout: 5000 });

      // School admin approves the request — membership moves pending → onboarding,
      // never straight to active (plan 19, Phase A).
      const adminLogin = new LoginPage(adminPage);
      await loginAs(adminLogin, SCHOOL_ADMIN);
      await expect(adminPage).toHaveURL(/\/school/, { timeout: 10000 });

      await adminPage.goto('/en/school/e2e-test-school/enrollment/requests');
      await adminPage.getByRole('button', { name: /accept/i }).first().click();
      await expect(adminPage.getByText(/accepted/i)).toBeVisible({ timeout: 5000 });

      // The onboarding wizard itself (placement test / availability / age band /
      // interview steps) is covered by its own tests; here we drive it through the
      // same BFF endpoint the wizard calls on its last step, to reach
      // `placement-review` deterministically regardless of which steps this
      // school's settings require.
      const schoolsRes = await studentPage.request.get('/api/student/schools');
      const schools = (await schoolsRes.json()) as Array<{ membershipId: string; schoolId: string; schoolSlug: string }>;
      const membership = schools.find((s) => s.schoolSlug === 'e2e-test-school');
      expect(membership, 'student should have a membership for e2e-test-school').toBeTruthy();

      const transitionRes = await studentPage.request.post(
        `/api/enrollment/memberships/${membership!.membershipId}/transition`,
        { data: { schoolId: membership!.schoolId, to: 'placement-review' } },
      );
      expect(transitionRes.ok()).toBeTruthy();

      // Admin places the student from the READY-TO-PLACE queue — the only path to `active`.
      await adminPage.goto('/en/school/e2e-test-school/enrollment/placement');
      await expect(adminPage.getByText(/placement queue/i)).toBeVisible({ timeout: 10000 });

      await adminPage.getByRole('combobox', { name: /select a group/i }).first().click();
      await adminPage.getByRole('option').first().click();
      await adminPage.getByRole('button', { name: /^assign$/i }).first().click();
      await expect(adminPage.getByText(/assigned to group/i)).toBeVisible({ timeout: 5000 });

      // Student now sees the group schedule on their school detail page.
      await studentPage.goto(`/en/student/schools/e2e-test-school`);
      await expect(studentPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
      await expect(studentPage.getByText(/classmates|schedule/i).first()).toBeVisible();
    } finally {
      await studentCtx.close();
      await adminCtx.close();
    }
  });
});
