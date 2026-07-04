import { BookOpen, Check, Pencil, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type UnitPhase =
  | 'read'
  | 'vocab-pass'
  | 'vocab-study'
  | 'grammar-read'
  | 'grammar-ex'
  | 'practice'
  | 'complete';

type StepLabelKey = 'readListen' | 'vocabulary' | 'grammar' | 'practice';

interface StepDef {
  id: string;
  labelKey: StepLabelKey;
  icon: typeof BookOpen;
  phaseIndex: number;
}

const STEPS: StepDef[] = [
  { id: 'read',     labelKey: 'readListen', icon: BookOpen, phaseIndex: 0 },
  { id: 'vocab',    labelKey: 'vocabulary', icon: BookOpen, phaseIndex: 1 },
  { id: 'grammar',  labelKey: 'grammar',    icon: Pencil,   phaseIndex: 2 },
  { id: 'practice', labelKey: 'practice',   icon: Target,   phaseIndex: 3 },
];

const PHASE_INDEX: Record<UnitPhase, number> = {
  'read':         0,
  'vocab-pass':   1,
  'vocab-study':  1,
  'grammar-read': 2,
  'grammar-ex':   2,
  'practice':     3,
  'complete':     4,
};

export interface UnitStepperProps {
  phase: UnitPhase;
  className?: string;
}

export function UnitStepper({ phase, className }: UnitStepperProps) {
  const t = useTranslations('Learning.unitStepper');
  const currentIndex = PHASE_INDEX[phase];

  return (
    <div
      className={cn('flex flex-1 items-start px-3', className)}
      role="list"
      aria-label={t('label')}
    >
      {STEPS.map((step, i) => {
        const done   = i < currentIndex;
        const active = i === currentIndex;
        const Icon   = step.icon;

        return (
          <div key={step.id} className="flex flex-1 items-start" role="listitem">
            {i > 0 && (
              <div
                aria-hidden="true"
                className={cn(
                  'mt-3.5 h-0.5 flex-1 transition-colors',
                  done ? 'bg-[var(--ssz-color-primary-500)]' : 'bg-[var(--ssz-border-default)]',
                )}
                style={{ transitionDuration: 'var(--ssz-duration-slower)', transitionTimingFunction: 'var(--ssz-ease-out)' }}
              />
            )}
            <div className="flex min-w-[64px] flex-col items-center gap-1.5">
              <div
                aria-label={`${t(step.labelKey)}${done ? ', completed' : active ? ', current' : ''}`}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all',
                  done
                    ? 'border-[var(--ssz-color-primary-500)] bg-[var(--ssz-color-primary-500)]'
                    : active
                    ? 'border-[var(--ssz-color-primary-500)] bg-[var(--ssz-bg-surface)] shadow-[0_0_0_4px_oklch(0.95_0.03_168)]'
                    : 'border-[var(--ssz-border-strong)] bg-[var(--ssz-bg-subtle)]',
                )}
                style={{ transitionDuration: 'var(--ssz-duration-slow)', transitionTimingFunction: 'var(--ssz-ease-out)' }}
              >
                {done ? (
                  <Check size={12} className="text-white" aria-hidden="true" />
                ) : (
                  <Icon
                    size={12}
                    className={active ? 'text-[var(--ssz-color-primary-500)]' : 'text-(--ssz-text-muted)'}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className={cn(
                  'max-w-14 text-center text-[10px] leading-tight',
                  active || done ? 'font-bold' : 'font-medium',
                  active
                    ? 'text-[var(--ssz-color-primary-700)]'
                    : done
                    ? 'text-(--ssz-text-secondary)'
                    : 'text-(--ssz-text-muted)',
                )}
              >
                {t(step.labelKey)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
