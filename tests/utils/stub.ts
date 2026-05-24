import type { Page, Route } from '@playwright/test';

export type StubBody = Record<string, unknown> | unknown[] | string | null;

export interface StubOptions {
  status?: number;
  headers?: Record<string, string>;
}

/** Intercept a URL pattern (glob or regex) and respond with a canned JSON body. */
export async function stubJson(
  page: Page,
  urlPattern: string | RegExp,
  body: StubBody,
  { status = 200, headers = {} }: StubOptions = {},
): Promise<void> {
  await page.route(urlPattern, (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers,
      body: JSON.stringify(body),
    }),
  );
}

/** Intercept a URL and return a 4xx/5xx error response. */
export async function stubError(
  page: Page,
  urlPattern: string | RegExp,
  status: number,
  message = 'Stubbed error',
): Promise<void> {
  await page.route(urlPattern, (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ message }),
    }),
  );
}

/** Remove all stubs from the page. Call in afterEach to reset state. */
export async function clearStubs(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}
