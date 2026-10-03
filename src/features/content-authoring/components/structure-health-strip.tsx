'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { useAtomCoverage } from '../api/use-atom-coverage';
import { useContainerCoverage } from '../api/use-container-coverage';
import { computeHealthSignals, type HealthAnchor, type HealthTone } from '../lib/health-signals';

interface StructureHealthStripProps {
  containerId: string;
  /** Opens the Coverage tab at the card the signal is about. */
  onOpenCoverage: (anchor: HealthAnchor) => void;
}

const TONE_CLASSES: Record<HealthTone, { chip: string; dot: string; value: string }> = {
  bad: {
    chip: 'border-error-200 bg-error-50 hover:border-error-300 dark:bg-error-500/10',
    dot: 'bg-error-500',
    value: 'text-error-700 dark:text-error-300',
  },
  warn: {
    chip: 'border-warning-200 bg-warning-50 hover:border-warning-300 dark:bg-warning-500/10',
    dot: 'bg-warning-500',
    value: 'text-warning-700 dark:text-warning-300',
  },
  neutral: {
    chip: 'border-border bg-card hover:border-foreground/30',
    dot: 'bg-muted-foreground/60',
    value: 'text-foreground',
  },
};

/**
 * The draft's zeroes, under the header, on the Structure tab only.
 *
 * The point of the band is that a course which trains no listening says so
 * without anyone opening the report — the report is one click away and has been
 * all along, and that click is exactly what never happens. Every signal is a
 * link into the card it came from, so the number and its explanation are never
 * more than one step apart (plan 64, phase 1).
 *
 * Drawn only once both reports are in: a strip of zeroes while the answer is
 * still in flight would accuse the author of something the data has not said.
 */
export function StructureHealthStrip({ containerId, onOpenCoverage }: StructureHealthStripProps) {
  const t = useTranslations('Authoring.health');
  const { data: coverage } = useContainerCoverage(containerId);
  const { data: atoms } = useAtomCoverage(containerId);

  const signals = computeHealthSignals(coverage, atoms);
  if (signals.length === 0) return null;

  return (
    <div className="-mx-4 -mb-3.5 mt-3 flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {t('label')}
      </span>

      {signals.map((signal) => {
        const tone = TONE_CLASSES[signal.tone];
        const label = t(`signal.${signal.id}`);
        return (
          <button
            key={signal.id}
            type="button"
            // Spelt out rather than left to the reading of a label and a number
            // glued together: "Listening0" is not what the chip says.
            aria-label={`${label} ${signal.value}`}
            onClick={() => onOpenCoverage(signal.anchor)}
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-full border pl-[7px] pr-2 text-xs text-muted-foreground transition-colors',
              tone.chip,
            )}
          >
            <span aria-hidden className={cn('size-[7px] shrink-0 rounded-full', tone.dot)} />
            {label}
            <b className={cn('font-bold tabular-nums', tone.value)}>{signal.value}</b>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onOpenCoverage('coverage-skills')}
        className="ml-auto text-xs font-semibold text-primary hover:underline"
      >
        {t('openReport')}
      </button>
    </div>
  );
}
