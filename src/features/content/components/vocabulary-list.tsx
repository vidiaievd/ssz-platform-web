'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { DataState } from '@/components/shared/data-state';
import { Badge } from '@/components/ui/badge';
import { useVocabularyItems } from '../api/use-vocabulary';
import { renderExample } from '../lib/render-example';
import type { VocabularyItem, VocabularyList } from '../types';

interface VocabularyListViewProps {
  list: VocabularyList;
}

function VocabularyEntry({ item }: { item: VocabularyItem }) {
  const primaryTranslation = item.translations[0]?.translation;

  return (
    <div className="border-border border-b py-4 last:border-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-base font-semibold">{item.lemma}</span>
        {item.ipa && (
          <span className="text-muted-foreground font-mono text-xs">[{item.ipa}]</span>
        )}
        {item.partOfSpeech && (
          <Badge variant="muted" className="text-xs">
            {item.partOfSpeech}
          </Badge>
        )}
      </div>

      {primaryTranslation && (
        <p className="text-muted-foreground mt-0.5 text-sm">{primaryTranslation}</p>
      )}

      {item.examples.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.examples.map((ex) => (
            <li key={ex.id} className="text-muted-foreground text-sm italic">
              {renderExample(ex.template, item.lemma)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VocabularyListView({ list }: VocabularyListViewProps) {
  const t = useTranslations('Content');
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useVocabularyItems(list.id);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-base font-semibold">{list.title}</h3>
        {list.itemCount !== undefined && (
          <span className="text-muted-foreground text-xs">
            ({t('wordCount', { count: list.itemCount })})
          </span>
        )}
      </div>

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && items.length === 0}
        onRetry={() => void refetch()}
        emptySlot={
          <p className="text-muted-foreground py-4 text-sm">{t('noVocabularyItems')}</p>
        }
      >
        <div>
          {items.map((item: VocabularyItem) => (
            <VocabularyEntry key={item.id} item={item} />
          ))}
        </div>

        {hasNextPage && (
          <button
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-primary mt-4 flex items-center gap-2 text-sm hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('loadMore')}
          </button>
        )}
      </DataState>
    </div>
  );
}
