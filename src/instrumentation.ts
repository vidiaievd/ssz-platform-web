import * as Sentry from '@sentry/nextjs';

/**
 * Server-side Sentry. Next looks for this file next to `app/` — here `src/` — and a copy at
 * the repository root is silently never loaded (OQ-43: it lay there, so Sentry never started).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.server.config');
  }
}

/** Errors thrown while rendering server components, route handlers and server actions. */
export const onRequestError = Sentry.captureRequestError;
