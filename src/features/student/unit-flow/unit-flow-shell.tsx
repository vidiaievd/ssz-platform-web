'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useUnitPayload, ErrorState, LearningSkeleton } from '@/features/learning';
import type { ExpandedVocabItem, RefStripParagraph } from '@/features/learning';

import { UFTopBar } from './uf-top-bar';
import { useUnitPhase } from './use-unit-phase';
import { ReadSection } from './read-section/read-section';
import type { GlossaryMap, TextParagraph } from './read-section/read-section-types';
import { VocabSection } from './vocab-section/vocab-section';
import { GrammarSection } from './grammar-section/grammar-section';
import type { GrammarQuickCheck } from './grammar-section/grammar-ex';
import { PracticeSection } from './practice-section/practice-section';
import { CompleteSection } from './complete-section/complete-section';

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
          className="sticky top-0 z-10 h-18 border-b border-(--ssz-border-default) bg-surface"
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
  const [practiceMistakes, setPracticeMistakes] = useState<string[]>([]);

  const glossary = useMemo(() => vocabToGlossary(module.vocabulary), [module.vocabulary]);
  const paragraphs = useMemo(() => parseParagraphs(module.lesson.bodyMarkdown), [module.lesson.bodyMarkdown]);

  const refParagraphs = useMemo<RefStripParagraph[]>(
    () => paragraphs.map((p) => ({ native: p.target, translation: p.translation || undefined })),
    [paragraphs],
  );

  const isVocabPhase   = phase === 'vocab-pass' || phase === 'vocab-study';
  const isGrammarPhase = phase === 'grammar-read' || phase === 'grammar-ex';

  /**
   * Derive a quick-check MCQ from the grammar rule's first two examples.
   * Question: "Which sentence uses «{rule title}» correctly?"
   * Correct option = example 0 target, distractors = remaining example targets.
   * Returns undefined when there are fewer than 2 examples.
   */
  const grammarExercise = useMemo<GrammarQuickCheck | undefined>(() => {
    const rule = module.grammar;
    if (!rule || rule.examples.length < 2) return undefined;
    const correctIdx = 0;
    const options = rule.examples.slice(0, 3).map((ex) => ex.target);
    return {
      question: rule.examples[0]?.translation
        ? `${rule.title}: ${rule.examples[0].translation}`
        : rule.title,
      options,
      correctIndex: correctIdx,
    };
  }, [module.grammar]);

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

        {isVocabPhase && (
          <VocabSection
            vocab={module.vocabulary}
            initialPhase={phase === 'vocab-study' ? 'study' : 'pass'}
            refParagraphs={refParagraphs}
            refTitle={module.lesson.title}
            onStudyStart={() => setPhase('vocab-study')}
            onContinue={() => setPhase('grammar-read')}
          />
        )}

        {isGrammarPhase && (
          <GrammarSection
            rule={module.grammar}
            exercise={grammarExercise}
            refParagraphs={refParagraphs}
            refTitle={module.lesson.title}
            onExStart={() => setPhase('grammar-ex')}
            onContinue={() => setPhase('practice')}
          />
        )}

        {phase === 'practice' && (
          <PracticeSection
            exercises={module.exercises}
            onComplete={(m) => {
              setPracticeMistakes(m);
              setPhase('complete');
            }}
          />
        )}

        {phase === 'complete' && (
          <CompleteSection
            unitNumber={unitNumber}
            unitTitle={module.title}
            vocabCount={module.vocabulary.length}
            mistakes={practiceMistakes}
            canDoDescriptors={module.canDoDescriptors}
            courseHref={courseHref}
          />
        )}
      </div>
    </div>
  );
}
