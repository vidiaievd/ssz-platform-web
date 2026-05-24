import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDef {
  id: string;
  label: string;
}

interface StepperProps {
  steps: StepDef[];
  /** 0-indexed index of the current active step. */
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepClick, className }: StepperProps) {
  return (
    <nav
      aria-label="Progress"
      className={cn('flex items-center gap-0', className)}
      role="tablist"
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = onStepClick && (isCompleted || isCurrent);

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${index + 1}. ${step.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              onClick={isClickable ? () => onStepClick(index) : undefined}
              disabled={!isClickable}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1.5 px-1 text-center transition-colors',
                'disabled:pointer-events-none',
                isClickable && 'cursor-pointer',
                !isClickable && !isCurrent && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isCurrent &&
                    'border-primary bg-background text-primary',
                  !isCompleted &&
                    !isCurrent &&
                    'border-muted-foreground/30 bg-background text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden text-[11px] font-medium leading-tight sm:block',
                  isCurrent && 'text-primary',
                  isCompleted && 'text-foreground',
                  !isCompleted && !isCurrent && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </button>

            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mx-1 h-[2px] flex-1 rounded-full transition-colors',
                  index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
