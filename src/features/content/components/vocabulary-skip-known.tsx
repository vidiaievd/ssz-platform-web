'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { useBulkIntroduceFromList, useIntroduceCard, useVocabularyItems } from '../api/use-vocabulary';
import type { VocabularyItem, VocabularyList } from '../types';

interface VocabularySkipKnownProps {
  list: VocabularyList;
  onDone: () => void;
}

export function VocabularySkipKnown({ list, onDone }: VocabularySkipKnownProps) {
  const t = useTranslations('Content.SkipKnown');
  const { data } = useVocabularyItems(list.id);
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const [index, setIndex] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const introduceCard = useIntroduceCard();
  const bulkIntroduce = useBulkIntroduceFromList();

  const total = items.length;
  const current: VocabularyItem | undefined = items[index];
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const finished = total > 0 && index >= total;

  function advance() {
    setIndex((i) => i + 1);
  }

  function handleKnow() {
    if (!current) return;
    setKnownCount((c) => c + 1);
    introduceCard.mutate({
      contentType: 'VOCABULARY_WORD',
      contentId: current.id,
      seedKind: 'CLAIMED_KNOWN',
    });
    advance();
  }

  function handleNew() {
    advance();
  }

  function handleSkipAllKnown() {
    bulkIntroduce.mutate(
      { vocabularyListId: list.id, seedKind: 'CLAIMED_KNOWN' },
      {
        onSuccess: () => {
          toast.success(t('skippedAll', { count: total }));
          onDone();
        },
        onError: () => toast.error(t('skipAllFailed')),
      },
    );
  }

  if (total === 0) return null;

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Sparkles className="text-(--ssz-primary) h-8 w-8" />
        <p className="text-sm font-medium">{t('doneSummary', { known: knownCount, total })}</p>
        <Button onClick={onDone}>{t('continue')}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <ProgressBar value={progress} className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkipAllKnown}
          disabled={bulkIntroduce.isPending}
        >
          {t('skipAllKnown')}
        </Button>
      </div>

      {current && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-6 py-10 text-center">
          <span className="text-2xl font-semibold">{current.lemma}</span>
          {current.ipa && (
            <span className="text-muted-foreground font-mono text-sm">[{current.ipa}]</span>
          )}
          {current.translations[0]?.translation && (
            <span className="text-muted-foreground text-sm">
              {current.translations[0].translation}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleNew}>
          <X className="h-4 w-4" />
          {t('new')}
        </Button>
        <Button className="flex-1 gap-2" onClick={handleKnow}>
          <Check className="h-4 w-4" />
          {t('know')}
        </Button>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="text-muted-foreground text-xs hover:underline"
      >
        {t('exit')}
      </button>
    </div>
  );
}
