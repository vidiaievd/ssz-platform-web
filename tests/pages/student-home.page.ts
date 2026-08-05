import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class StudentHomePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(locale = 'en') {
    return `/${locale}/student/home`;
  }

  async goto(locale = 'en') {
    await this.page.goto(this.url(locale));
    await this.page.waitForSelector('main, h1');
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** The Resume/hero panel's primary CTA — "Continue"/"Start" link into the reader. */
  get resumeCta() {
    return this.page.getByRole('link', { name: /continue|resume|start/i }).first();
  }

  /** Rendered when the student has no courses yet — points at the catalogue instead. */
  get exploreCoursesCta() {
    return this.page.getByRole('link', { name: /explore|browse|catalogue/i }).first();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
