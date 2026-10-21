'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

import '@/styles/globals.css';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/**
 * Last-resort boundary: replaces the root layout when it (or the locale layout)
 * throws. No providers or translations are available here, so the copy is
 * English only and the markup avoids shared components.
 */
export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error.digest ?? '', error);
    Sentry.captureException(error, { tags: { boundary: 'global', digest: error.digest } });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <main
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ maxWidth: '24rem', margin: 0, opacity: 0.75 }}>
            The application could not start this page. Try again, or come back in a few minutes.
          </p>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', margin: 0, opacity: 0.6 }}>
              Reference: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => unstable_retry()}>
              Try again
            </button>
            {/* A full navigation, not a client one: the router tree is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go to the home page</a>
          </div>
        </main>
      </body>
    </html>
  );
}
