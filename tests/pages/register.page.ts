import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type RegisterRole = 'student' | 'school' | 'tutor';

const ROLE_PATHS: Record<RegisterRole, string> = {
  student: 'student',
  tutor: 'tutor',
  school: 'school',
};

export class RegisterPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Navigate to the register hub. */
  async gotoHub(locale = 'en') {
    await this.page.goto(`/${locale}/register`);
  }

  /** Navigate directly to the role-specific registration form. */
  async goto(role: RegisterRole = 'student', locale = 'en') {
    await this.page.goto(`/${locale}/register/${ROLE_PATHS[role]}`);
    await this.page.waitForSelector('#email');
  }

  get emailInput() { return this.page.locator('#email'); }
  get passwordInput() { return this.page.locator('#password'); }
  get passwordConfirmInput() { return this.page.locator('#passwordConfirm'); }
  get termsCheckbox() { return this.page.locator('#acceptedTerms'); }
  get submitButton() { return this.page.getByRole('button', { name: 'Create account' }); }

  /** Hub-level role card selectors. */
  studentCard() { return this.page.getByRole('link', { name: /I want to learn/ }); }
  schoolOrTutorCard() { return this.page.getByRole('button', { name: /I teach or run a school/ }); }

  async fillForm(opts: { email: string; password: string }) {
    await this.emailInput.fill(opts.email);
    await this.passwordInput.fill(opts.password);
    await this.passwordConfirmInput.fill(opts.password);
    await this.termsCheckbox.check();
  }

  async register(opts: { email: string; password: string; role?: RegisterRole }) {
    await this.goto(opts.role ?? 'student');
    await this.fillForm(opts);
    await this.submitButton.click();
  }

  /** After successful registration the app redirects to /verify-email. */
  async expectRedirectToVerifyEmail() {
    await expect(this.page).toHaveURL(/\/verify-email/, { timeout: 8000 });
    await expect(this.page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  }
}
