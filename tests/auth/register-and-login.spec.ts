import { test, expect } from '@playwright/test';

import { RegisterPage } from '../pages/register.page';
import { LoginPage } from '../pages/login.page';
import { stubJson } from '../utils/stub';

/**
 * Critical flow: register → verify email → login
 *
 * Hybrid strategy:
 * - Registration and login are tested against the live backend (when available).
 * - Email verification is stubbed: we intercept the BFF verify endpoint and the
 *   backend's debug token endpoint so the flow runs without a real mailbox.
 *
 * To run against live backend: ensure E2E_STUB_ONLY is not set and the backend
 * is running with seeds (see tests/utils/seeds/README.md).
 *
 * To run in stub-only mode (no backend): E2E_STUB_ONLY=true npm run e2e -- --grep "@stub"
 */

const UNIQUE_EMAIL = () => `test-${Date.now()}@e2e.test`;

test.describe('Register and login flow', () => {
  test('register page renders required fields @stub', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.passwordConfirmInput).toBeVisible();
    await expect(registerPage.roleRadio('student')).toBeVisible();
    await expect(registerPage.roleRadio('school')).toBeVisible();
    await expect(registerPage.roleRadio('tutor')).toBeVisible();
    await expect(registerPage.termsCheckbox).toBeVisible();
    await expect(registerPage.submitButton).toBeVisible();
  });

  test('register form shows success state after submission @stub', async ({ page }) => {
    const email = UNIQUE_EMAIL();

    await stubJson(page, '**/api/auth/register', {
      message: 'Registration successful. Please verify your email.',
    });

    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.register({ email, password: 'TestPass1!', role: 'student' });
    await registerPage.expectSuccessState(email);
  });

  test('login page renders required fields @stub', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await expect(loginPage.signUpLink).toBeVisible();
  });

  test('login shows error for invalid credentials @stub', async ({ page }) => {
    await stubJson(page, '**/api/auth/login', { message: 'Invalid email or password.' }, { status: 401 });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@e2e.test', 'WrongPass1!');
    await loginPage.expectLoginError();
  });

  test('verify-email page with valid token marks email verified @stub', async ({ page }) => {
    await stubJson(page, '**/api/auth/verify-email', {
      message: 'Email verified successfully.',
    });

    await page.goto('/en/verify-email?token=stub-valid-token');
    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 8000 });
  });

  /**
   * Full register → verify → login flow (live backend required).
   * Skipped automatically when E2E_STUB_ONLY=true.
   */
  test('full register → verify → login (live backend)', async ({ page }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const email = UNIQUE_EMAIL();
    const password = 'LiveTest1!';

    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.register({ email, password, role: 'student' });
    await registerPage.expectSuccessState(email);

    // Fetch the verification token via the backend debug endpoint (dev/e2e only).
    const tokenRes = await page.request.get(
      `/api/dev/last-verification-token?email=${encodeURIComponent(email)}`,
    );
    expect(tokenRes.ok()).toBeTruthy();
    const { token } = await tokenRes.json() as { token: string };

    await page.goto(`/en/verify-email?token=${token}`);
    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 8000 });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);

    await expect(page).toHaveURL(/\/student\/enrolled/, { timeout: 10000 });
  });
});
