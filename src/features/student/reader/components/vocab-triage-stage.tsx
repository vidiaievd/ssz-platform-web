'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { useBulkIntroduceFromList, useIntroduceCard } from '@/features/content';
import { learningKeys } from '@/features/learning';
import type { VocabularyItem } from '@/features/content/types';

import { WordAudioButton, posMeta } from './vocab-flip-card';

export interface VocabTriageStageProps {
  vocabularyListId: string;
  items: VocabularyItem[];
  /** Language of the words, for the pronunciation voice. */
  lang: string;
  /** Ids the learner claimed to know; the rest go to the learn stage. */
  onFinish: (knownIds: string[]) => void;
}

/**
 * First pass over a unit's words: one word at a time, "know it" or "new to me".
 * A claimed word is seeded into SRS immediately (`CLAIMED_KNOWN`), so the
 * scheduler stops treating it as unseen and the learn stage can leave it out —
 * the point of the stage is to spend the learner's attention only on the rest.
 */
export function VocabTriageStage({
  vocabularyListId,
  items,
  lang,
  onFinish,
}: VocabTriageStageProps) {
  const t = useTranslations('Learning.reader.vocab.flow.triage');
  const tVocab = useTranslations('Learning.reader.vocab');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();

  const [index, setIndex] = useState(0);
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const introduceCard = useIntroduceCard();
  const bulkIntroduce = useBulkIntroduceFromList();

  const total = items.length;
  const current = items[index];
  const done = index >= total;

  // Card states are keyed per batch of ids; the empty list is the shared prefix,
  // so every reader query that could underline this word is refetched.
  function invalidateCardStates() {
    void queryClient.invalidateQueries({
      queryKey: learningKeys.srsCardStates('VOCABULARY_WORD', []),
    });
  }

  function advance(nextKnown: string[]) {
    if (index + 1 >= total) {
      onFinish(nextKnown);
      return;
    }
    setIndex((i) => i + 1);
  }

  function handleKnow() {
    if (!current) return;
    const nextKnown = [...knownIds, current.id];
    setKnownIds(nextKnown);
    introduceCard.mutate(
      { contentType: 'VOCABULARY_WORD', contentId: current.id, seedKind: 'CLAIMED_KNOWN' },
      { onSuccess: invalidateCardStates, onError: () => toast.error(tErrors('unknown')) },
    );
    advance(nextKnown);
  }

  function handleNew() {
    advance(knownIds);
  }

  function handleKnowAll() {
    bulkIntroduce.mutate(
      { vocabularyListId, seedKind: 'CLAIMED_KNOWN' },
      {
        onSuccess: () => {
          invalidateCardStates();
          onFinish(items.map((i) => i.id));
        },
        onError: () => toast.error(tErrors('unknown')),
      },
    );
  }

  if (done || !current) return null;

  const { bg, fg } = posMeta(current.partOfSpeech);
  const posKey = `pos.${current.partOfSpeech ?? 'other'}` as Parameters<typeof tVocab>[0];
  const posLabel = tVocab.has(posKey) ? tVocab(posKey) : (current.partOfSpeech ?? tVocab('pos.other'));

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar
          value={Math.round((index / total) * 100)}
          label={t('progressLabel')}
          className="flex-1"
        />
        <span className="text-xs font-semibold text-(--ssz-text-muted)" aria-live="polite">
          {t('progress', { current: index + 1, total })}
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface px-6 py-12 text-center shadow-(--ssz-shadow-sm)">
        <span
          className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: bg, color: fg }}
        >
          {posLabel}
        </span>
        <span className="font-reading text-[34px] leading-[1.1] font-semibold text-(--ssz-text-primary)">
          {current.lemma}
        </span>
        {current.ipa && <span className="font-mono text-xs text-(--ssz-text-muted)">{current.ipa}</span>}
        <WordAudioButton word={current.lemma} mediaId={current.audioMediaId} lang={lang} />
      </div>

      <p className="mt-4 text-center text-[12.5px] text-(--ssz-text-muted)">{t('hint')}</p>

      <div className="mt-4 flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleNew}>
          <X className="h-4 w-4" aria-hidden="true" />
          {t('new')}
        </Button>
        <Button className="flex-1 gap-2" onClick={handleKnow}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {t('know')}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={handleKnowAll}
          disabled={bulkIntroduce.isPending}
          className="text-xs font-semibold text-(--ssz-text-muted) hover:underline disabled:opacity-50"
        >
          {t('knowAll')}
        </button>
        <button
          type="button"
          onClick={() => onFinish(knownIds)}
          className="text-xs font-semibold text-(--ssz-text-muted) hover:underline"
        >
          {t('skip')}
        </button>
      </div>
    </div>
  );
}
