'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

export type RouteErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/**
 * Fallback for a route segment's `error.tsx`. Rendered inside the segment's
 * layout, so the app shell around it stays usable. Only reads the global
 * `Errors` namespace, which every surface provider carries.
 */
export function RouteError({ error, unstable_retry }: RouteErrorProps) {
  const t = useTranslations('Errors');

  useEffect(() => {
    // Server errors arrive with only a digest; the full stack is in the server log under it.
    console.error('[RouteError]', error.digest ?? '', error);
    Sentry.captureException(error, { tags: { boundary: 'route', digest: error.digest } });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="bg-error-100 inline-flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="text-error-600 size-6" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-(--ssz-text-primary)">{t('boundary_title')}</h2>
          <p className="text-sm text-(--ssz-text-muted)">{t('boundary_body')}</p>
          {error.digest && (
            <p className="font-mono text-xs text-(--ssz-text-muted)">
              {t('boundary_reference', { digest: error.digest })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => unstable_retry()} className="gap-2">
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('retry')}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{t('go_home')}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

/** Default export shape for `error.tsx` files that only need the shared fallback. */
export default function RouteErrorBoundary(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
