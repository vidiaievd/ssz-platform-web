import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side Sentry. With SDK 10 and Turbopack the client is started from this file; the
 * old `sentry.client.config.ts` is no longer injected into the bundle.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Capture 10% of traces in production; 100% locally for easy debugging.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
});

/** Ties client-side navigations to traces. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
