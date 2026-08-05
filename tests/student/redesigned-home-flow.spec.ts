import { test, expect } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { StudentHomePage } from '../pages/student-home.page';
import { StudentReviewsPage } from '../pages/student-reviews.page';
import { StudentCataloguePage } from '../pages/student-catalogue.page';

/**
 * Critical flow for the redesigned student surface (docs/plan/13-student-home-redesign.md):
 * log in → Home renders → Resume opens the reader → nav to Reviews → start a
 * review → nav to Catalogue → filter → enrol.
 *
 * This exercises the real dev backend (the `infrastructure-*` docker stack +
 * gateway on :80 that ssz-platform-web/.env.local already points at), using
 * the persistent dev fixture account below — not the aspirational
 * docker-compose.e2e.yml stack described in tests/utils/seeds/README.md,
 * which does not exist in this repo. Skipped under E2E_STUB_ONLY.
 */

const STUDENT = { email: 'student@example.com', password: '!Password1234' };

/**
 * These screens fetch their data client-side (loading → empty/populated), so
 * a bare `.isVisible()` right after navigation races the skeleton. Wait for
 * the element to actually settle before branching on it.
 */
async function isVisibleEventually(locator: import('@playwright/test').Locator, timeout = 8000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

test.describe('Redesigned student home flow', () => {
  test('log in → home → resume → reviews → review → catalogue → filter → enrol', async ({
    page,
  }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires the live dev backend (infrastructure-* containers)',
    );
    // A single long chain over the live backend — more headroom than the 30s default.
    test.setTimeout(90_000);

    // 1. Log in and land on the redesigned Home screen.
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(STUDENT.email, STUDENT.password);
    await expect(page).toHaveURL(/\/student\/home/, { timeout: 10000 });

    const home = new StudentHomePage(page);
    await home.expectLoaded();

    // 2. Resume opens the reader — or, for a student with nothing started yet,
    // the empty state's catalogue CTA is the honest equivalent.
    if (await isVisibleEventually(home.resumeCta)) {
      await home.resumeCta.click();
      await expect(page).toHaveURL(/\/student\/(enrolled\/lessons|courses)\//, { timeout: 10000 });
      await expect(page.locator('main').first()).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/student\/home/);
    } else {
      await expect(home.exploreCoursesCta).toBeVisible();
    }

    // 3. Nav to Reviews.
    await page.getByRole('link', { name: 'Reviews', exact: true }).first().click();
    await expect(page).toHaveURL(/\/student\/reviews/);

    const reviews = new StudentReviewsPage(page);
    await reviews.expectLoaded();

    // 4. Start a review — "Review all now" when something is due, otherwise
    // drive the SRS entry point directly so the flow still covers it.
    if (await isVisibleEventually(reviews.reviewAllButton)) {
      await reviews.reviewAllButton.click();
    } else {
      await expect(reviews.emptyState).toBeVisible();
      await page.goto('/en/student/srs');
    }
    await expect(page).toHaveURL(/\/student\/srs/, { timeout: 10000 });

    const startReviewButton = page.getByRole('button', { name: /start review/i });
    if (await isVisibleEventually(startReviewButton)) {
      await startReviewButton.click();
      // A review card is showing once the session starts.
      await expect(page.getByRole('button', { name: /show answer/i })).toBeVisible({
        timeout: 5000,
      });
    } else {
      await expect(page.getByRole('heading', { name: /caught up/i })).toBeVisible();
    }

    // 5. Nav to Catalogue.
    await page.getByRole('link', { name: 'Catalogue', exact: true }).first().click();
    await expect(page).toHaveURL(/\/student\/catalogue/);

    const catalogue = new StudentCataloguePage(page);
    await catalogue.expectLoaded();

    // 6. Filter: switch to the Free tab, then narrow further by search.
    await catalogue.freeTab.click();
    await expect(page).toHaveURL(/tab=free/);

    const firstCard = page.locator('main a[aria-label]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    const courseTitle = await firstCard.getAttribute('aria-label');
    const courseHref = await firstCard.getAttribute('href');
    expect(courseTitle).toBeTruthy();
    expect(courseHref).toBeTruthy();

    const resultCountBefore = await catalogue.resultCount.textContent();
    await catalogue.searchInput.fill(courseTitle!.slice(0, Math.min(8, courseTitle!.length)));
    await expect(catalogue.resultCount).not.toHaveText(resultCountBefore ?? '', { timeout: 5000 });
    await expect(page.locator('main a[aria-label]').first()).toBeVisible();

    // 7. Enrol in the free course captured before filtering (avoids relying
    // on a locator over an element that just re-rendered under the search box).
    await page.goto(courseHref!);
    await expect(page.getByRole('button', { name: /enroll/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /enroll/i }).click();
    await expect(page.getByText(/enrolled/i)).toBeVisible({ timeout: 5000 });
  });
});
