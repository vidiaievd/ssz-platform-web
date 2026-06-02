import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export type OnboardingStep = 'profile' | 'prefs';

const STEPS: OnboardingStep[] = ['profile', 'prefs'];

type StepIndicatorProps = {
  currentStep: OnboardingStep;
  progressLabel: string;
  stepNames: string[];
};

export function StepIndicator({ currentStep, progressLabel, stepNames }: StepIndicatorProps) {
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <>
      {/* Desktop: visual step bar with names */}
      <div
        role="progressbar"
        aria-valuenow={currentIdx + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={progressLabel}
        className="hidden md:flex items-start gap-0"
      >
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;

          return (
            <div key={step} className="flex items-start">
              {/* Node + name */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full transition-colors duration-(--ssz-duration-base)',
                    isDone
                      ? 'bg-primary-600'
                      : idx === currentIdx
                        ? 'bg-primary-600 ring-2 ring-primary-600 ring-offset-2 ring-offset-surface'
                        : 'bg-neutral-200',
                  )}
                  aria-label={isDone ? `${stepNames[idx]} — completed` : undefined}
                  aria-current={idx === currentIdx ? 'step' : undefined}
                >
                  {isDone ? (
                    <Check className="size-3.5 text-white" aria-hidden />
                  ) : (
                    <span
                      className={cn(
                        'text-[10px] font-semibold leading-none',
                        idx === currentIdx ? 'text-white' : 'text-neutral-500',
                      )}
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    idx === currentIdx
                      ? 'text-(--ssz-text-primary)'
                      : isDone
                        ? 'text-(--ssz-text-secondary)'
                        : 'text-(--ssz-text-muted)',
                  )}
                >
                  {stepNames[idx]}
                </span>
              </div>

              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-16 mt-3 mx-1 transition-colors duration-(--ssz-duration-base)',
                    isDone ? 'bg-primary-600' : 'bg-neutral-200',
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: text-only progress */}
      <p className="md:hidden text-sm font-medium text-(--ssz-text-secondary)">
        {progressLabel}
      </p>
    </>
  );
}
