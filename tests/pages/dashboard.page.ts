import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(locale = 'en') {
    return `/${locale}/student/enrolled`;
  }

  async goto(locale = 'en') {
    await this.page.goto(this.url(locale));
    await this.page.waitForSelector('main');
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get continueLearningSection() {
    return this.page.getByRole('region', { name: /continue/i });
  }

  get lessonCards(): Locator {
    return this.page.locator('[data-slot="lesson-card"]');
  }

  async expectWelcomeGreeting() {
    const heading = this.heading;
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
  }

  async expectRedirectToLogin() {
    await this.page.goto(this.url());
    await expect(this.page).toHaveURL(/\/login/);
  }
}
