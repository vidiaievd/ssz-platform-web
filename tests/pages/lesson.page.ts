import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class LessonPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  url(lessonId: string, containerId?: string, locale = 'en') {
    const base = `/${locale}/student/enrolled/lessons/${lessonId}`;
    return containerId ? `${base}?containerId=${containerId}` : base;
  }

  async goto(lessonId: string, containerId?: string, locale = 'en') {
    await this.page.goto(this.url(lessonId, containerId, locale));
    await this.page.waitForSelector('main');
  }

  get lessonTitle() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get completeButton() {
    return this.page.getByRole('button', { name: /complete|mark complete/i });
  }

  get nextLessonButton() {
    return this.page.getByRole('link', { name: /next/i });
  }

  get prevLessonButton() {
    return this.page.getByRole('link', { name: /previous/i });
  }

  get exerciseSubmitButton() {
    return this.page.getByRole('button', { name: /check|submit/i });
  }

  get exerciseFeedback() {
    return this.page.locator('[data-slot="exercise-feedback"]');
  }

  async expectLessonLoaded() {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async complete() {
    await this.completeButton.click();
  }

  async submitExercise(answer: string) {
    const input = this.page.locator('input[type="text"], textarea').first();
    await input.fill(answer);
    await this.exerciseSubmitButton.click();
  }
}
