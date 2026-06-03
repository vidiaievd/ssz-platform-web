'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { WidgetCard } from './widget-card';
import type { OnboardingState } from '../types';

type OnboardingChecklistProps = {
  onboarding: OnboardingState;
};

const ITEM_LABELS: Record<string, string> = {
  'create-course': 'Create your first course',
  'invite-teacher': 'Invite a teacher',
  'fill-branding': 'Set up school branding',
  'invite-students': 'Invite students',
  'publish-lesson': 'Publish your first lesson',
};

export function OnboardingChecklist({ onboarding }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const { items, completed, total, minutesLeft } = onboarding;
  const percent = Math.round((completed / total) * 100);

  return (
    <WidgetCard
      title="Get your school running"
      accent
      subtitle={`${completed} of ${total} complete · ~${minutesLeft} min left`}
      headerRight={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide onboarding checklist"
          className="size-7 -mr-1"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </Button>
      }
    >
      <div
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-4"
      >
        <ProgressBar value={percent} height={6} />
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => {
          const label = ITEM_LABELS[item.key] ?? item.key;
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
                    ~{item.est}
                  </span>
                )}
              </div>
              {!item.done && (
                <Link
                  href={item.href}
                  className="shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Go →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
