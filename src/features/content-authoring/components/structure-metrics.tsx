'use client';

import { useTranslations } from 'next-intl';

import type { CurriculumTree } from '@/features/content/types';

import { computeStructureMetrics } from '../lib/structure-metrics';

interface StructureMetricsProps {
  tree: CurriculumTree | undefined;
  /**
   * How many nodes are waiting to go live. Passed in rather than derived here so
   * it cannot drift from the Review & publish badge and dialog, which count the
   * same rows (BEHAVIOR.md §5.2).
   */
  unpublished: number;
}

/** `flex-col-reverse` so the number reads above its label while `dt` still precedes `dd` in the DOM. */
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xl font-bold leading-tight tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Size of the course at a glance, under the title. The old page said "0 lessons
 * available" and nothing else; an author sizing up a rewrite needs the counts
 * and, above all, how much of it students cannot see yet.
 */
export function StructureMetrics({ tree, unpublished }: StructureMetricsProps) {
  const t = useTranslations('Authoring.metrics');
  const { levels, modules, lessons, exercises, estimatedMinutes } = computeStructureMetrics(tree);

  const estimate =
    estimatedMinutes >= 60
      ? t('hours', { value: Math.round((estimatedMinutes / 60) * 10) / 10 })
      : t('minutes', { value: estimatedMinutes });

  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Metric value={String(levels)} label={t('levels')} />
      <Metric value={String(modules)} label={t('modules')} />
      <Metric value={String(lessons)} label={t('lessons')} />
      <Metric value={String(exercises)} label={t('exercises')} />
      <Metric value={estimate} label={t('estTime')} />
      <Metric value={String(unpublished)} label={t('unpublished')} />
    </dl>
  );
}
