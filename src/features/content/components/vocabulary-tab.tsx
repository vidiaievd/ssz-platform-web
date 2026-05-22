'use client';

import { useTranslations } from 'next-intl';

import { DataState } from '@/components/shared/data-state';
import { useContainerItems } from '../api/use-container-items';
import { useVocabularyList } from '../api/use-vocabulary';
import { VocabularyListView } from './vocabulary-list';

interface VocabularyTabProps {
  containerId: string;
  versionId?: string;
}

function VocabListSection({ listId }: { listId: string }) {
  const { data: list, isLoading, error } = useVocabularyList(listId);

  return (
    <DataState isLoading={isLoading} error={error ? { code: 'unknown' } : null} isEmpty={!list}>
      {list && <VocabularyListView list={list} />}
    </DataState>
  );
}

export function VocabularyTab({ containerId, versionId }: VocabularyTabProps) {
  const t = useTranslations('Content');
  const { data, isLoading, error, refetch } = useContainerItems(
    containerId,
    versionId ?? '',
    !!versionId,
  );

  const items = (data ?? []).filter((i) => i.contentType === 'VOCABULARY_LIST');

  return (
    <DataState
      isLoading={isLoading}
      error={error ? { code: 'unknown' } : null}
      isEmpty={!isLoading && items.length === 0}
      onRetry={() => void refetch()}
      emptySlot={
        <p className="text-muted-foreground py-8 text-center text-sm">{t('noVocabulary')}</p>
      }
    >
      <div className="space-y-6">
        {items.map((item) => (
          <VocabListSection key={item.id} listId={item.contentId} />
        ))}
      </div>
    </DataState>
  );
}
