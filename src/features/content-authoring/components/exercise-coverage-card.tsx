'use client';

import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { deriveSkills } from '@/lib/shared-kernel/skills';
import { cn } from '@/lib/utils';

import { useExerciseAxes } from '../api/use-exercise-axes';
import { mergeAxes } from '../lib/live-axes';
import { ExerciseAxesPanel } from './exercise-axes-panel';

interface ExerciseCoverageCardProps {
  exerciseId: string;
  /** The container whose exercise list is refetched after the panel saves. */
  containerId?: string;
  templateCode: string;
  /** The document as the builder holds it this second, not as it was last saved. */
  document: unknown;
  className?: string;
}

function Axis({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
      <p className="truncate text-[11px] text-muted-foreground" title={source}>
        {source}
      </p>
    </div>
  );
}

/**
 * What the exercise in front of you counts as, while you are building it.
 *
 * Nine builders were shipped without this: the axes panel lived on the old general form
 * only, so an author using any type rewritten since plan 49 could not see what their
 * exercise trained until it turned up in a report. Worse, the audio toggle moves the
 * channel — and a metric that only agrees with the document after a save is a metric that
 * teaches authors to distrust it.
 *
 * Read from the live draft, merged with what the service knows about placement and about
 * what the author already declared (`mergeAxes`). "Refine" opens the panel that writes an
 * override; it is an escape hatch, not a step — the derivation gets the seeded catalogue
 * right with no authoring work at all.
 */
export function ExerciseCoverageCard({
  exerciseId,
  containerId,
  templateCode,
  document,
  className,
}: ExerciseCoverageCardProps) {
  const t = useTranslations('Authoring.axes');
  const tAxis = useTranslations('Authoring.coverage');
  const [refining, setRefining] = useState(false);
  const { data: saved } = useExerciseAxes(exerciseId);

  const draft = useMemo(
    () => deriveSkills({ templateCode, content: document }),
    [templateCode, document],
  );
  const axes = mergeAxes(saved, draft);

  const list = (values: readonly string[], prefix: 'skill' | 'focus') =>
    values.length === 0
      ? tAxis(`${prefix}.unknown` as 'focus.unknown')
      : values.map((value) => tAxis(`${prefix}.${value}` as 'skill.listening')).join(', ');

  return (
    <section className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-2">
        <Target className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-xs font-bold tracking-wide text-muted-foreground">{t('title')}</h3>
        <button
          type="button"
          onClick={() => setRefining((open) => !open)}
          aria-expanded={refining}
          className="ml-auto text-xs font-semibold text-primary hover:underline"
        >
          {refining ? t('refineClose') : t('refine')}
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Axis
          label={tAxis('axis.skill')}
          value={list(axes.skills, 'skill')}
          source={t(`source.${axes.skillSource}` as 'source.template')}
        />
        <Axis
          label={tAxis('axis.focus')}
          value={list(axes.focus, 'focus')}
          source={t(`source.${axes.focusSource}` as 'source.template')}
        />
        <Axis
          label={tAxis('axis.form')}
          value={tAxis(`modality.${axes.modality ?? 'unknown'}` as 'modality.recognition')}
          source={t('source.modalityHint')}
        />
      </dl>

      {refining && (
        <div className="mt-3 border-t border-border pt-3">
          <ExerciseAxesPanel exerciseId={exerciseId} containerId={containerId} />
        </div>
      )}
    </section>
  );
}
