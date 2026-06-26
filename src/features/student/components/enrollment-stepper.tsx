'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MembershipStatus } from '@/features/enrollment/types';

type StepperStep = 'application' | 'placement' | 'group' | 'schedule';

const STEPS: StepperStep[] = ['application', 'placement', 'group', 'schedule'];

const STEP_INDEX_BY_STATUS: Record<'pending' | 'onboarding' | 'placement-review' | 'active', number> = {
  pending: 0,
  onboarding: 1,
  'placement-review': 2,
  active: 3,
};

/** `null` for terminal statuses ('rejected' | 'left') that fall outside the linear flow. */
export function stepIndexForStatus(status: MembershipStatus): number | null {
  if (status === 'rejected' || status === 'left') return null;
  return STEP_INDEX_BY_STATUS[status];
}

interface EnrollmentStepperProps {
  status: MembershipStatus;
}

/**
 * Honest 4-step view of where a membership stands: Application → Placement →
 * Group → Schedule. `active` is the only status with every step done — there
 * is no "active without a group" state (see plan 19). Renders nothing for
 * 'rejected' / 'left' — callers show a dedicated message for those instead.
 */
export function EnrollmentStepper({ status }: EnrollmentStepperProps) {
  const t = useTranslations('Student.SchoolStatus');
  const currentIndex = stepIndexForStatus(status);
  if (currentIndex === null) return null;

  const stepLabel = (step: StepperStep) => {
    if (step === 'application') return t('stepApplication');
    if (step === 'placement') return t('stepPlacement');
    if (step === 'group') return t('stepGroup');
    return t('stepSchedule');
  };

  return (
    <ol className="flex flex-wrap items-center gap-y-2 gap-x-3" aria-label={t('stepperLabel')}>
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex || status === 'active';
        const isCurrent = !isDone && i === currentIndex;

        return (
          <li
            key={step}
            className="flex items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${t('stepNumber', { n: i + 1 })}: ${stepLabel(step)}${isDone ? ` (${t('stepDone')})` : ''}`}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isDone
                  ? 'bg-success text-white'
                  : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-border text-muted-foreground',
              )}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span
              aria-hidden="true"
              className={cn('text-sm', isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground')}
            >
              {stepLabel(step)}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="mx-1 text-muted-foreground">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
