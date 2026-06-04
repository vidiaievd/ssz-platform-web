'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Dashboard] error boundary caught:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-error-100">
          <AlertTriangle className="size-6 text-error-600" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-(--ssz-text-primary)">
            Failed to load dashboard
          </h2>
          <p className="text-sm text-(--ssz-text-muted)">
            Something went wrong while loading the dashboard. Individual widgets may have their own
            retry buttons if only a part of the page failed.
          </p>
        </div>
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    </main>
  );
}
