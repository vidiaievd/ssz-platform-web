import { test, expect } from '@playwright/test';

import { stubJson } from '../utils/stub';

/**
 * Critical path: onboarding flow (stub-only)
 *
 * Covers the profile step → preferences step → dashboard redirect.
 * Server actions are exercised through the BFF; API responses are stubbed.
 */

const STUB_PROFILE = {
  id: 'prof-1',
  userId: 'user-1',
  displayName: 'Test User',
  bio: '',
  timezone: 'UTC',
  uiLocale: 'en',
  hasStudentProfile: false,
  hasTutorProfile: false,
};

async function stubOnboardingApis(page: Parameters<typeof stubJson>[0]) {
  // Auth guard
  await stubJson(page, '**/api/auth/roles', { roles: ['student'] });
  // Profile fetch (for form pre-fill)
  await stubJson(page, '**/api/profiles/me', STUB_PROFILE);
  // Student sub-profile 404 → no redirect (not yet onboarded)
  await page.route('**/api/profiles/me/student', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    } else {
      route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }
  });
  // Profile PATCH
  await stubJson(page, '**/api/profiles/me', STUB_PROFILE);
}

test.describe('Onboarding flow @stub', () => {
  test('onboarding page shows profile step with display name field', async ({ page }) => {
    await stubOnboardingApis(page);

    await page.goto('/en/onboarding');

    await expect(page.getByRole('heading', { name: /Tell us about yourself/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.locator('#displayName')).toBeVisible();
  });

  test('step indicator shows Profile as active step', async ({ page }) => {
    await stubOnboardingApis(page);

    await page.goto('/en/onboarding');

    // Desktop step bar shows "Profile" label
    await expect(page.getByText('Profile').first()).toBeVisible({ timeout: 8000 });
  });

  test('verify-email guard: unauthenticated user is redirected to login', async ({ page }) => {
    // No auth cookies — stubbing roles as 401
    await page.route('**/api/auth/roles', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/en/onboarding');

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('already-onboarded user is redirected away from /onboarding', async ({ page }) => {
    await stubJson(page, '**/api/auth/roles', { roles: ['student'] });
    // Profile says student profile already exists
    await stubJson(page, '**/api/profiles/me', {
      ...STUB_PROFILE,
      hasStudentProfile: true,
    });
    await stubJson(page, '**/api/profiles/me/student', {
      id: 'sp-1',
      nativeLanguage: 'en',
      targetLanguages: [],
    });

    await page.goto('/en/onboarding');

    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 8000 });
  });

  test('preferences step empty state shows "What would you like to learn?" @stub', async ({
    page,
  }) => {
    await stubOnboardingApis(page);

    await page.goto('/en/onboarding');

    // Fill display name and advance to step 2
    await page.locator('#displayName').fill('Test User');
    await page.route('**/onboarding*', (route) => route.continue()); // allow PATCH
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(
      page.getByText('What would you like to learn?').first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('"Skip for now" shows inline callout instead of dialog @stub', async ({ page }) => {
    await stubOnboardingApis(page);

    await page.goto('/en/onboarding');
    await page.locator('#displayName').fill('Test User');
    await page.getByRole('button', { name: 'Next' }).click();

    // Wait for prefs step
    await expect(page.getByText('Skip for now')).toBeVisible({ timeout: 8000 });
    await page.getByText('Skip for now').click();

    // Inline callout should appear — not a dialog
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip anyway' })).toBeVisible();
    // No AlertDialog overlay
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  });

  /**
   * Full register → verify → onboarding → dashboard (live backend required).
   * Skipped automatically when E2E_STUB_ONLY=true.
   */
  test('register → verify → complete onboarding → student dashboard (live backend)', async ({
    page,
  }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const email = `onboard-${Date.now()}@e2e.test`;
    const password = 'OnboardTest1!';

    // 1. Register as student
    await page.goto('/en/register/student');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#passwordConfirm').fill(password);
    await page.locator('#acceptedTerms').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 8000 });

    // 2. Verify email via debug endpoint
    const tokenRes = await page.request.get(
      `/api/dev/last-verification-token?email=${encodeURIComponent(email)}`,
    );
    expect(tokenRes.ok()).toBeTruthy();
    const { token } = await tokenRes.json() as { token: string };
    await page.goto(`/en/verify-email?token=${token}`);

    // 3. Should land on onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Tell us about yourself/i })).toBeVisible();

    // 4. Complete profile step
    await page.locator('#displayName').fill('E2E Student');
    await page.getByRole('button', { name: 'Next' }).click();

    // 5. Skip preferences step (optional)
    await expect(page.getByText('Skip for now')).toBeVisible({ timeout: 8000 });
    await page.getByText('Skip for now').click();
    await page.getByRole('button', { name: 'Skip anyway' }).click();

    // 6. Should reach student dashboard
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
  });
});
