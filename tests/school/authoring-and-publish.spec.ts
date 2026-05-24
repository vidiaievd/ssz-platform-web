import { test, expect } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { ContainerPage } from '../pages/container.page';
import { stubJson } from '../utils/stub';

/**
 * Critical flow: school admin creates a container, adds a lesson,
 * publishes with slug retype confirmation, verifies it appears in
 * the public catalogue.
 *
 * Hybrid strategy:
 * - Stub-tagged tests verify individual UI surfaces without a backend.
 * - Full authoring + publish tests require the live backend with e2e seeds.
 *   Admin: school@e2e.test / E2eSchool1!
 *   Seeded container: id=e2e-test-container, slug=e2e-test-course
 *   See tests/utils/seeds/README.md for setup.
 */

const SCHOOL_ADMIN = { email: 'school@e2e.test', password: 'E2eSchool1!' };
const SEEDED_CONTAINER = { id: 'e2e-test-container', slug: 'e2e-test-course', title: 'E2E Test Course' };

test.describe('Authoring and publish flow', () => {
  test('school content list is protected — redirects to login when unauthenticated @stub', async ({
    page,
  }) => {
    await page.goto('/en/school/content');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('new container form renders required fields @stub', async ({ page }) => {
    await stubJson(page, '**/api/auth/me', {
      id: 'admin-1',
      roles: [{ role: 'SCHOOL', schoolId: 'school-1' }],
    });

    // Simulate an authenticated session by stubbing session check
    await page.goto('/en/school/content/new');
    await expect(page.locator('#title')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#slug')).toBeVisible();
  });

  test('container detail page shows title and publish button (live backend)', async ({ page }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(SCHOOL_ADMIN.email, SCHOOL_ADMIN.password);
    await expect(page).toHaveURL(/\/school/, { timeout: 10000 });

    const containerPage = new ContainerPage(page);
    await containerPage.goto(SEEDED_CONTAINER.id);
    await containerPage.expectTitle(SEEDED_CONTAINER.title);
    await expect(containerPage.publishButton).toBeVisible();
  });

  test('full authoring flow: create container → add lesson → publish (live backend)', async ({
    page,
  }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(SCHOOL_ADMIN.email, SCHOOL_ADMIN.password);
    await expect(page).toHaveURL(/\/school/, { timeout: 10000 });

    // Create a new container
    const slug = `e2e-autotest-${Date.now()}`;
    await page.goto('/en/school/content/new');
    await page.locator('#title').fill('E2E Auto-generated Course');
    await page.locator('#slug').fill(slug);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/school\/content\/[^/]+$/, { timeout: 8000 });

    // Add a lesson via the Lessons tab
    await page.getByRole('tab', { name: 'Lessons' }).click();
    await page.getByRole('button', { name: 'Add lesson' }).click();
    await expect(page.getByText('Untitled lesson')).toBeVisible({ timeout: 5000 });

    // Navigate back to the container detail to publish
    const containerUrl = page.url();
    const containerId = containerUrl.split('/').pop() as string;
    const containerPage = new ContainerPage(page);
    await containerPage.goto(containerId);

    // Publish — retype the slug in the confirmation dialog
    await containerPage.publish(slug);
    await containerPage.expectPublishSuccessToast();

    // Verify it appears in the public catalogue
    await page.goto('/en/catalogue');
    await expect(page.getByText('E2E Auto-generated Course')).toBeVisible({ timeout: 8000 });
  });
});
