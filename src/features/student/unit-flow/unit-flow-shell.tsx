'use client';

import { useTranslations } from 'next-intl';

import { useUnitPayload, ErrorState, LearningSkeleton } from '@/features/learning';
import { cn } from '@/lib/utils';

import { UFTopBar } from './uf-top-bar';
import { useUnitPhase } from './use-unit-phase';
import type { UnitPhase } from './types';

const ALL_PHASES: UnitPhase[] = [
  'read',
  'vocab-pass',
  'vocab-study',
  'grammar-read',
  'grammar-ex',
  'practice',
  'complete',
];

export interface UnitFlowShellProps {
  unitId: string;
  /**
   * Where the "← Course" exit link should go.
   * Typically `/student/courses/[courseId]`.
   */
  courseHref: string;
}

export function UnitFlowShell({ unitId, courseHref }: UnitFlowShellProps) {
  const t = useTranslations('Learning.unitFlow');
  const { data, isLoading, isError, refetch } = useUnitPayload(unitId);
  const { phase, setPhase } = useUnitPhase(unitId);

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="flex h-full flex-col" style={{ background: 'var(--ssz-bg-base)' }}>
        {/* Top-bar skeleton */}
        <div
          className="sticky top-0 z-10 h-[72px] border-b border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)]"
          aria-hidden="true"
        />
        <div className="flex flex-1 justify-center px-6 pt-10">
          <div className="w-full" style={{ maxWidth: 600 }}>
            {/* Hero image placeholder */}
            <div
              className="mb-6 h-[156px] w-full animate-pulse rounded-2xl bg-[var(--ssz-bg-subtle)]"
              aria-hidden="true"
            />
            <LearningSkeleton variant="text" rows={11} />
          </div>
        </div>
      </div>
    );
  }

  /* ── error ── */
  if (isError || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6" style={{ background: 'var(--ssz-bg-base)' }}>
        <ErrorState
          title={t('loadError')}
          description={t('loadErrorSub')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { module } = data;
  const unitNumber = module.position;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--ssz-bg-base)' }}>
      <UFTopBar
        phase={phase}
        unitNumber={unitNumber}
        courseHref={courseHref}
      />

      {/* Scrollable body */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto">
        {/*
          Phase content will be rendered here in F2.2–F2.5.
          Placeholder for F2.1 verification: shows current phase + phase nav.
        */}
        <div className="w-full px-6 pb-32 pt-8" style={{ maxWidth: 600 }}>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[var(--ssz-text-muted)]">
            {module.cefrLevel} · {module.title}
          </p>
          <p className="text-sm text-[var(--ssz-text-secondary)]">
            {t('phaseDebug', { phase })}
          </p>

          {/* Phase nav — for F2.1 verification only; removed in F2.2 */}
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Phase navigation (dev)">
            {ALL_PHASES.map((p) => (
              <button
                key={p}
                onClick={() => setPhase(p)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  phase === p
                    ? 'bg-[var(--ssz-color-primary-500)] text-white'
                    : 'bg-[var(--ssz-bg-subtle)] text-[var(--ssz-text-secondary)] hover:bg-[var(--ssz-border-default)]',
                )}
                style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
