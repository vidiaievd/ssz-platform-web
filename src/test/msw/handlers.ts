import { http, HttpResponse } from 'msw';

/**
 * Default handlers shared across tests, dev, and Storybook.
 * Feature-specific handlers live next to their features and are
 * appended via `server.use(...)` / `worker.use(...)`.
 */
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true })),
];
