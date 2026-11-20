'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { wsHref } from '@/features/workspaces/lib/href';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { WidgetCard } from './widget-card';
import type { OnboardingState } from '../types';

type OnboardingChecklistProps = {
  onboarding: OnboardingState;
  /** The workspace segment of the current URL (id or slug); item links hang off it. */
  workspaceId: string;
};

export function OnboardingChecklist({ onboarding, workspaceId }: OnboardingChecklistProps) {
  const t = useTranslations('School.dashboard.onboarding');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const { items, completed, total, minutesLeft } = onboarding;
  const percent = Math.round((completed / total) * 100);

  return (
    <WidgetCard
      title={t('title')}
      accent
      subtitle={t('progress', { completed, total, minutes: minutesLeft })}
      headerRight={
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('hide')}
          className="size-7 -mr-1"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </Button>
      }
    >
      <div
        role="progressbar"
        aria-label={t('progressLabel')}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-4"
      >
        <ProgressBar value={percent} height={6} />
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => {
          const label = t(`items.${item.labelKey}`);
          return (
            <li key={item.key} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle2
                  className="size-5 shrink-0 text-success-600"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="size-5 shrink-0 text-(--ssz-text-muted)"
                  aria-hidden="true"
                />
              )}
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm',
                    item.done
                      ? 'line-through text-(--ssz-text-muted)'
                      : 'text-(--ssz-text-primary)',
                  )}
                >
                  {label}
                </span>
                {!item.done && (
                  <span className="font-mono text-[11px] text-(--ssz-text-muted) shrink-0">
                    {t('minutes', { minutes: item.estMinutes })}
                  </span>
                )}
              </div>
              {!item.done && item.href !== null && (
                <Link
                  href={wsHref(workspaceId, item.href)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {t('go')}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
