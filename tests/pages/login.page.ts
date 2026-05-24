import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(locale = 'en') {
    return `/${locale}/login`;
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

  get submitButton() {
    return this.page.getByRole('button', { name: 'Sign in' });
  }

  get forgotPasswordLink() {
    return this.page.getByRole('link', { name: 'Forgot password?' });
  }

  get signUpLink() {
    return this.page.getByRole('link', { name: 'Sign up' });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectLoginError() {
    await expect(
      this.page.getByText('Invalid email or password.'),
    ).toBeVisible();
  }
}
