'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useUnitPayload, ErrorState, LearningSkeleton } from '@/features/learning';
import type { ExpandedVocabItem } from '@/features/learning';

import { UFTopBar } from './uf-top-bar';
import { useUnitPhase } from './use-unit-phase';
import { ReadSection } from './read-section/read-section';
import type { GlossaryMap, TextParagraph } from './read-section/read-section-types';

export interface UnitFlowShellProps {
  unitId: string;
  /** Where the "← Course" exit link should go. */
  courseHref: string;
}

/** Derive a GlossaryMap from the module's vocabulary list. */
function vocabToGlossary(vocab: ExpandedVocabItem[]): GlossaryMap {
  return vocab.reduce<GlossaryMap>((acc, item) => {
    const key = item.word.toLowerCase();
    const tag = (item.pos === 'verb' ? 'verb' : item.pos === 'adj' ? 'adj' : 'noun') as GlossaryMap[string]['tag'];
    acc[key] = { ph: item.ipa ?? '', tr: item.translation, tag };
    return acc;
  }, {});
}

/** Split bodyMarkdown into TextParagraph[] (target = markdown text, no translation yet). */
function parseParagraphs(bodyMarkdown: string): TextParagraph[] {
  return bodyMarkdown
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((target) => ({ target, translation: '' }));
}

export function UnitFlowShell({ unitId, courseHref }: UnitFlowShellProps) {
  const t = useTranslations('Learning.unitFlow');
  const { data, isLoading, isError, refetch } = useUnitPayload(unitId);
  const { phase, setPhase } = useUnitPhase(unitId);

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="flex h-full flex-col" style={{ background: 'var(--ssz-bg-base)' }}>
        <div
          className="sticky top-0 z-10 h-[72px] border-b border-(--ssz-border-default) bg-surface"
          aria-hidden="true"
        />
        <div className="flex flex-1 justify-center px-6 pt-10">
          <div className="w-full" style={{ maxWidth: 640 }}>
            <div
              className="mb-7 h-45 w-full animate-pulse rounded-[20px] bg-subtle"
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
      <div
        className="flex h-full flex-col items-center justify-center px-6"
        style={{ background: 'var(--ssz-bg-base)' }}
      >
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
    <UnitFlowContent
      unitId={unitId}
      courseHref={courseHref}
      module={module}
      unitNumber={unitNumber}
      phase={phase}
      setPhase={setPhase}
    />
  );
}

/* ── Inner content — extracted so hooks run unconditionally ── */

interface ContentProps {
  unitId: string;
  courseHref: string;
  module: NonNullable<ReturnType<typeof useUnitPayload>['data']>['module'];
  unitNumber: number;
  phase: ReturnType<typeof useUnitPhase>['phase'];
  setPhase: ReturnType<typeof useUnitPhase>['setPhase'];
}

function UnitFlowContent({ courseHref, module, unitNumber, phase, setPhase }: ContentProps) {
  const glossary = useMemo(() => vocabToGlossary(module.vocabulary), [module.vocabulary]);
  const paragraphs = useMemo(() => parseParagraphs(module.lesson.bodyMarkdown), [module.lesson.bodyMarkdown]);

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--ssz-bg-base)' }}>
      <UFTopBar phase={phase} unitNumber={unitNumber} courseHref={courseHref} />

      <div className="flex flex-1 flex-col items-center overflow-y-auto">
        {phase === 'read' && (
          <ReadSection
            unitNumber={unitNumber}
            courseTitle={module.cefrLevel ? `${module.cefrLevel} · ${module.title}` : module.title}
            lessonTitle={module.lesson.title}
            paragraphs={paragraphs}
            glossary={glossary}
            audioUrl={module.lesson.audioUrl}
            onContinue={() => setPhase('vocab-pass')}
          />
        )}

        {/* Remaining phases — F2.3–F2.5 will fill these in */}
        {phase !== 'read' && (
          <div className="w-full px-6 pb-32 pt-8" style={{ maxWidth: 600 }}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-(--ssz-text-muted)">
              {module.cefrLevel} · {module.title}
            </p>
            <p className="mb-6 text-sm text-(--ssz-text-secondary)">Phase: {phase}</p>
            <div className="flex flex-wrap gap-2">
              {(['read', 'vocab-pass', 'vocab-study', 'grammar-read', 'grammar-ex', 'practice', 'complete'] as const).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhase(p)}
                    className={
                      phase === p
                        ? 'rounded-lg bg-(--ssz-color-primary-500) px-3 py-1.5 text-xs font-medium text-white'
                        : 'rounded-lg bg-subtle px-3 py-1.5 text-xs font-medium text-(--ssz-text-secondary) hover:bg-(--ssz-border-default)'
                    }
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
