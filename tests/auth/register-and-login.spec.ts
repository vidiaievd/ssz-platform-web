import { test, expect } from '@playwright/test';

import { RegisterPage } from '../pages/register.page';
import { LoginPage } from '../pages/login.page';
import { stubJson } from '../utils/stub';

const UNIQUE_EMAIL = () => `test-${Date.now()}@e2e.test`;

test.describe('Register and login flow', () => {
  test('register hub renders role choice cards @stub', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.gotoHub();

    await expect(registerPage.studentCard()).toBeVisible();
    await expect(registerPage.schoolOrTutorCard()).toBeVisible();
  });

  test('student register page renders required fields @stub', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto('student');

    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.passwordConfirmInput).toBeVisible();
    await expect(registerPage.termsCheckbox).toBeVisible();
    await expect(registerPage.submitButton).toBeVisible();
  });

  test('tutor register page renders required fields @stub', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto('tutor');

    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.submitButton).toBeVisible();
  });

  test('register redirects to /verify-email on success @stub', async ({ page }) => {
    const email = UNIQUE_EMAIL();

    await stubJson(page, '**/api/auth/register', { userId: 'u1', email });

    const registerPage = new RegisterPage(page);
    await registerPage.register({ email, password: 'TestPass1!', role: 'student' });
    await registerPage.expectRedirectToVerifyEmail();
  });

  test('register shows email-taken toast and field error on conflict @stub', async ({ page }) => {
    await stubJson(
      page,
      '**/api/auth/register',
      { title: 'Conflict', detail: 'Email already taken.' },
      { status: 409 },
    );

    const registerPage = new RegisterPage(page);
    await registerPage.goto('student');
    await registerPage.fillForm({ email: 'exists@e2e.test', password: 'TestPass1!' });
    await registerPage.submitButton.click();

    // Both toast and field error should appear
    await expect(
      page.getByText('An account with this email already exists.').first(),
    ).toBeVisible({ timeout: 5000 });
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
    await stubJson(
      page,
      '**/api/auth/login',
      { message: 'Invalid email or password.' },
      { status: 401 },
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@e2e.test', 'WrongPass1!');
    await loginPage.expectLoginError();
  });

  test('verify-email page with valid token shows success and redirects @stub', async ({ page }) => {
    await stubJson(page, '**/api/auth/verify-email', {
      accessToken: 'stub-at',
      refreshToken: 'stub-rt',
    });
    // Stub the /auth/me and /profiles/me calls that happen after verification
    await stubJson(page, '**/api/auth/me', { roles: ['student'] });
    await stubJson(page, '**/api/profiles/me', { hasStudentProfile: false, hasTutorProfile: false });

    await page.goto('/en/verify-email?token=stub-valid-token');
    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 8000 });
  });

  test('verify-email page without token shows check-your-email screen @stub', async ({ page }) => {
    await page.goto('/en/verify-email');
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resend email' })).toBeVisible();
  });

  /**
   * Full register → verify → onboarding flow (live backend required).
   * Skipped automatically when E2E_STUB_ONLY=true.
   */
  test('full register → verify → onboarding (live backend)', async ({ page }) => {
    test.skip(
      process.env['E2E_STUB_ONLY'] === 'true',
      'Requires live backend with e2e seed',
    );

    const email = UNIQUE_EMAIL();
    const password = 'LiveTest1!';

    const registerPage = new RegisterPage(page);
    await registerPage.register({ email, password, role: 'student' });
    await registerPage.expectRedirectToVerifyEmail();

    const tokenRes = await page.request.get(
      `/api/dev/last-verification-token?email=${encodeURIComponent(email)}`,
    );
    expect(tokenRes.ok()).toBeTruthy();
    const { token } = await tokenRes.json() as { token: string };

    await page.goto(`/en/verify-email?token=${token}`);
    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 8000 });

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });
  });
});
