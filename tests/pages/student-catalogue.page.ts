import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class StudentCataloguePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(locale = 'en') {
    return `/${locale}/student/catalogue`;
  }

  async goto(locale = 'en') {
    await this.page.goto(this.url(locale));
  }

  get heading() {
    return this.page.getByRole('heading', { name: /discover courses/i });
  }

  get freeTab() {
    return this.page.getByRole('tab', { name: /free/i });
  }

  get searchInput() {
    return this.page.getByPlaceholder(/search courses/i);
  }

  /** The live "N courses" pill in the filter bar (`aria-live="polite"`). */
  get resultCount() {
    return this.page.locator('[aria-live="polite"][aria-atomic="true"]');
  }

  courseCard(title: string | RegExp) {
    return this.page.getByRole('link', { name: title });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
