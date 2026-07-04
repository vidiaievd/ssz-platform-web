import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ReadinessTone = 'ok' | 'warn' | 'neutral' | 'muted';

export interface ReadinessChipProps {
  tone: ReadinessTone;
  label: string;
  className?: string;
}

const TONE_CLASSES: Record<ReadinessTone, string> = {
  ok:      'bg-success-50 text-success-700 border-success-200',
  warn:    'bg-warning-50 text-warning-700 border-warning-200',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  muted:   'border border-dashed border-neutral-300 text-neutral-400 bg-transparent',
};

export function ReadinessChip({ tone, label, className }: ReadinessChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {tone === 'ok' && <CheckCircle2 size={10} aria-hidden />}
      {tone === 'warn' && (
        <AlertTriangle
          size={10}
          aria-hidden
          /* accessible context is in the label; extra sr-only prefix added by callers if needed */
        />
      )}
      {label}
    </span>
  );
}

/* ── Derived readiness chips for a module row ── */

export interface ModuleReadiness {
  hasAnchorText: boolean;
  lessonCount: number;
  exerciseCount: number;
}

export function moduleReadinessChips(r: ModuleReadiness): ReadinessChipProps[] {
  const chips: ReadinessChipProps[] = [];

  chips.push(
    r.hasAnchorText
      ? { tone: 'ok',   label: 'Anchor text' }
      : { tone: 'warn', label: 'No anchor text yet' },
  );

  if (r.lessonCount === 0) {
    chips.push({ tone: 'warn',    label: 'No lessons' });
    chips.push({ tone: 'muted',   label: 'Empty module' });
  } else {
    chips.push({ tone: 'neutral', label: `${r.lessonCount} ${r.lessonCount === 1 ? 'lesson' : 'lessons'}` });
  }

  if (r.exerciseCount > 0) {
    chips.push({ tone: 'neutral', label: `${r.exerciseCount} ${r.exerciseCount === 1 ? 'exercise' : 'exercises'}` });
  }

  return chips;
}
