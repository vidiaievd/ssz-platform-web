'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { ErrorState, LearningSkeleton, getGlossaryMode } from '@/features/learning';
import { useUnitVocabularyItems, useVocabularyList } from '@/features/content';
import { cn } from '@/lib/utils';
import type { DifficultyLevel } from '@/features/content/types';

import type { VocabCardMode } from './vocab-flip-card';
import { VocabDoneStage } from './vocab-done-stage';
import { VocabLearnStage } from './vocab-learn-stage';
import { VocabStageTracker, type VocabStage } from './vocab-stage-tracker';
import { VocabTriageStage } from './vocab-triage-stage';
import { VocabWordList } from './vocab-word-list';
import type { ReaderSidebarItem } from '../types';

export const getVocabCardMode: (cefrLevel: string) => VocabCardMode = getGlossaryMode;

type VocabView = 'flow' | 'list';

function findReinforceItem(
  siblingItems: ReaderSidebarItem[],
  currentItemId: string,
): ReaderSidebarItem | undefined {
  const currentIndex = siblingItems.findIndex((i) => i.id === currentItemId);
  const after = siblingItems.slice(currentIndex + 1);
  const before = siblingItems.slice(0, currentIndex === -1 ? 0 : currentIndex);
  return [...after, ...before].find((i) => i.kind !== 'vocab' && i.status !== 'locked');
}

export interface VocabularyPageProps {
  vocabularyListId: string;
  cefrLevel: DifficultyLevel | string;
  unitPosition: number;
  courseTitle: string;
  srsVocabDue: number;
  siblingItems: ReaderSidebarItem[];
  currentItemId: string;
}

/**
 * A unit's new words, as a short activity rather than a wall of cards: sort the
 * words the learner already knows out of the way, meet the rest one at a time,
 * then hand them over to the text that uses them. The full list stays one click
 * away for looking things up while reading.
 */
export function VocabularyPage({
  vocabularyListId,
  cefrLevel,
  unitPosition,
  courseTitle,
  srsVocabDue,
  siblingItems,
  currentItemId,
}: VocabularyPageProps) {
  const t = useTranslations('Learning.reader.vocab');
  const tFlow = useTranslations('Learning.reader.vocab.flow');
  const tContent = useTranslations('Content');

  const [view, setView] = useState<VocabView>('flow');
  const [stage, setStage] = useState<VocabStage>('triage');
  const [knownIds, setKnownIds] = useState<string[]>([]);

  const list = useVocabularyList(vocabularyListId);
  const items = useUnitVocabularyItems(vocabularyListId);

  const isLoading = list.isLoading || items.isLoading;
  const isError = list.isError || items.isError;

  if (isLoading) {
    return <LearningSkeleton variant="card" rows={4} />;
  }

  if (isError || !list.data || !items.data) {
    return (
      <ErrorState
        onRetry={() => {
          list.refetch();
          items.refetch();
        }}
      />
    );
  }

  if (items.data.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('page.emptyTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('page.emptyBody')}</p>
      </div>
    );
  }

  const allItems = items.data;
  const cardMode = getVocabCardMode(cefrLevel);
  const lang = list.data.targetLanguage || 'nb';
  const reinforceItem = findReinforceItem(siblingItems, currentItemId);
  const unknownItems = allItems.filter((i) => !knownIds.includes(i.id));

  function restart() {
    setKnownIds([]);
    setStage('triage');
  }

  function finishTriage(known: string[]) {
    setKnownIds(known);
    setStage(known.length === allItems.length ? 'done' : 'learn');
  }

  const views: Array<{ id: VocabView; label: string }> = [
    { id: 'flow', label: tFlow('viewFlow') },
    { id: 'list', label: tFlow('viewList') },
  ];

  return (
    <div>
      <div className="mb-3.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-text-accent) uppercase">
          {t('page.eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.vocab') })}
        </div>
        <h1 className="font-reading mb-1 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {list.data.title}
        </h1>
        <div className="text-sm text-(--ssz-text-muted) italic">
          {t('page.newWords', { count: allItems.length })}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-full border-[1.5px] border-(--ssz-border-default) bg-surface p-0.5"
          role="tablist"
          aria-label={tFlow('viewLabel')}
        >
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
                view === v.id
                  ? 'bg-(--ssz-bg-brand-solid) text-(--ssz-text-on-brand)'
                  : 'text-(--ssz-text-muted)',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-(--ssz-border-default) bg-(--ssz-bg-accent) px-2.5 py-1 text-[11px] font-bold text-(--ssz-text-accent)">
          {cardMode === 'definition' ? t('page.levelBadgeDefinition') : t('page.levelBadgeTranslation')}
        </span>
      </div>

      {view === 'list' ? (
        <VocabWordList items={allItems} cardMode={cardMode} lang={lang} />
      ) : (
        <>
          <VocabStageTracker stage={stage} />
          {stage === 'triage' && (
            <VocabTriageStage
              vocabularyListId={vocabularyListId}
              items={allItems}
              lang={lang}
              onFinish={finishTriage}
            />
          )}
          {stage === 'learn' && (
            <VocabLearnStage
              items={unknownItems}
              cardMode={cardMode}
              lang={lang}
              onFinish={() => setStage('done')}
            />
          )}
          {stage === 'done' && (
            <VocabDoneStage
              knownCount={knownIds.length}
              learnedCount={unknownItems.length}
              reinforceItem={reinforceItem}
              srsVocabDue={srsVocabDue}
              onRestart={restart}
            />
          )}
        </>
      )}
    </div>
  );
}
