'use client';

import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import type { VocabularyItem } from '@/features/content/types';

import { VocabFlipCard, type VocabCardMode } from './vocab-flip-card';

export interface VocabLearnStageProps {
  items: VocabularyItem[];
  cardMode: VocabCardMode;
  /** Language of the words, for the pronunciation voice. */
  lang: string;
  onFinish: () => void;
}

/**
 * The words the learner did not claim, one at a time. A single card instead of
 * a grid: the grid let the eye slide over twenty words at once, which is how a
 * reference sheet is read, not how a word is learned.
 */
export function VocabLearnStage({ items, cardMode, lang, onFinish }: VocabLearnStageProps) {
  const t = useTranslations('Learning.reader.vocab.flow.learn');
  const [index, setIndex] = useState(0);

  const total = items.length;
  const current = items[index];
  const isLast = index === total - 1;

  if (!current) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar
          value={Math.round(((index + 1) / total) * 100)}
          label={t('progressLabel')}
          className="flex-1"
        />
        <span className="text-xs font-semibold text-(--ssz-text-muted)" aria-live="polite">
          {t('progress', { current: index + 1, total })}
        </span>
      </div>

      {/* Keyed by id so the next word always arrives face-down. */}
      <VocabFlipCard key={current.id} item={current} cardMode={cardMode} lang={lang} />

      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('prev')}
        </Button>
        <Button
          className="ml-auto gap-2"
          onClick={() => (isLast ? onFinish() : setIndex((i) => i + 1))}
        >
          {isLast ? t('finish') : t('next')}
          {isLast ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
}
