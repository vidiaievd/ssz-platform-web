import { cn } from '@/lib/utils';

export type OnboardingStep = 'role' | 'profile' | 'prefs';

const STEPS: OnboardingStep[] = ['role', 'profile', 'prefs'];

type StepIndicatorProps = {
  currentStep: OnboardingStep;
  progressLabel: string;
};

export function StepIndicator({ currentStep, progressLabel }: StepIndicatorProps) {
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <div
      role="progressbar"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuetext={progressLabel}
      className="flex items-center"
    >
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors duration-[var(--ssz-duration-base)] motion-safe:transition-all',
                isDone
                  ? 'bg-[var(--ssz-color-primary-300)]'
                  : isActive
                    ? 'bg-[var(--ssz-color-primary-600)] scale-110'
                    : 'bg-[var(--ssz-neutral-200)]',
              )}
            />
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-px w-10 transition-colors duration-[var(--ssz-duration-base)]',
                  isDone ? 'bg-[var(--ssz-color-primary-300)]' : 'bg-[var(--ssz-neutral-200)]',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
