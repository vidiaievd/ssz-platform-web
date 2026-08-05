import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class StudentReviewsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(locale = 'en') {
    return `/${locale}/student/reviews`;
  }

  async goto(locale = 'en') {
    await this.page.goto(this.url(locale));
  }

  get heading() {
    return this.page.getByRole('heading', { name: /reviews & reminders/i });
  }

  get reviewAllButton() {
    return this.page.getByRole('button', { name: /review all now/i });
  }

  get emptyState() {
    return this.page.getByText(/nothing to review right now/i);
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
