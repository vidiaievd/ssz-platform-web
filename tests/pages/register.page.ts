import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type RegisterRole = 'student' | 'school' | 'tutor';

export class RegisterPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(locale = 'en') {
    return `/${locale}/register`;
  }

  async goto(locale = 'en') {
    await this.page.goto(this.url(locale));
    await this.page.waitForSelector('#email');
  }

  get emailInput() {
    return this.page.locator('#email');
  }

  get passwordInput() {
    return this.page.locator('#password');
  }

  get passwordConfirmInput() {
    return this.page.locator('#passwordConfirm');
  }

  roleRadio(role: RegisterRole) {
    return this.page.locator(`#role-${role}`);
  }

  get termsCheckbox() {
    return this.page.locator('#acceptedTerms');
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Create account' });
  }

  get signInLink() {
    return this.page.getByRole('link', { name: 'Sign in' });
  }

  async register(opts: {
    email: string;
    password: string;
    role: RegisterRole;
  }) {
    await this.emailInput.fill(opts.email);
    await this.passwordInput.fill(opts.password);
    await this.passwordConfirmInput.fill(opts.password);
    await this.roleRadio(opts.role).check();
    await this.termsCheckbox.check();
    await this.submitButton.click();
  }

  async expectSuccessState(email: string) {
    await expect(this.page.getByText('Check your email')).toBeVisible();
    await expect(this.page.getByText(email)).toBeVisible();
  }
}
