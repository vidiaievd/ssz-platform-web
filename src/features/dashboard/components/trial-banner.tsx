'use client';

import { useState } from 'react';
import { Clock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

type TrialBannerProps = {
  daysLeft: number;
};

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-warning-800 dark:border-warning-800 dark:bg-warning-950/30 dark:text-warning-300"
    >
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">
        Your trial ends in <strong>{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</strong>.
        Upgrade to keep full access.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-warning-800 hover:bg-warning-100 dark:text-warning-300"
        >
          Compare plans
        </Button>
        <Button
          size="sm"
          className="h-7"
        >
          Upgrade
        </Button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss trial banner"
          className="ml-1 rounded p-0.5 hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
