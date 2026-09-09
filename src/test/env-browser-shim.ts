/**
 * `@/lib/env` as a browser test run may have it.
 *
 * Storybook renders client components in a real browser, and a client component may
 * legitimately import a server action — in the product that import compiles to a
 * reference and the action's module never reaches the browser, but a story loads the
 * module graph literally, down to `serverFetch` and the server-only environment it reads.
 * The T3 env object refuses to be read on the client, by design, and that refusal is what
 * broke the story rather than anything in the component under test.
 *
 * So the browser project gets these values instead. They are deliberately obvious
 * throwaways: nothing in a story should reach a service, and a URL that looks real would
 * make a story that quietly does so harder to notice.
 */
export const env = {
  NODE_ENV: 'test',
  API_GATEWAY_URL: 'http://storybook.invalid',
  UPSTREAM_API_PREFIX: '/api/v1',
  AUTH_COOKIE_SECRET: 'storybook-storybook-storybook-storybook',
} as unknown as typeof import('@/lib/env').env;
