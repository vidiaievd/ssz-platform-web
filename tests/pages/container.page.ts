import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class ContainerPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(id: string, locale = 'en') {
    return `/${locale}/school/content/${id}`;
  }

  async goto(id: string, locale = 'en') {
    await this.page.goto(this.url(id, locale));
    await this.page.waitForSelector('h1');
  }

  get title() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get publishButton() {
    return this.page.getByRole('button', { name: /publish/i });
  }

  get slugConfirmInput() {
    return this.page.getByRole('textbox', { name: /type.*confirm/i });
  }

  get confirmPublishButton() {
    return this.page.getByRole('button', { name: /confirm/i });
  }

  get breadcrumb() {
    return this.page.getByRole('navigation', { name: /breadcrumb/i });
  }

  async expectTitle(name: string) {
    await expect(this.title).toHaveText(name);
  }

  async publish(slug: string) {
    await this.publishButton.click();
    await this.slugConfirmInput.fill(slug);
    await this.confirmPublishButton.click();
  }

  async expectPublishSuccessToast() {
    await expect(this.page.getByRole('status')).toContainText(/published/i);
  }
}
