'use client';

import { useTranslations } from 'next-intl';

import { useAuthoringVocabularyItems } from '../api/use-authoring-vocabulary';

interface VocabularyLessonPreviewProps {
  title: string;
  listId: string | undefined;
}

/** Live "exactly what the learner sees" preview for a VOCAB lesson, rendered inside `PhoneFrame`. */
export function VocabularyLessonPreview({ title, listId }: VocabularyLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const { data } = useAuthoringVocabularyItems(listId ?? '', 1, !!listId);
  const first = data?.items[0];

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
        {data && (
          <div className="mt-0.5 text-xs text-muted-foreground">{t('vocabulary.wordCount', { count: data.total })}</div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 px-4 py-5.5">
        {first ? (
          <div className="flex h-50 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface shadow-md">
            <div className="font-reading text-[26px] font-semibold text-(--ssz-text-primary)">
              {first.lemma}
            </div>
            {first.ipa && (
              <div className="font-mono text-xs text-muted-foreground">/{first.ipa}/</div>
            )}
            <div className="mt-1.5 text-xs text-muted-foreground">{t('vocabulary.tapToFlip')}</div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm italic text-muted-foreground">
            {t('lessons.previewEmpty')}
          </p>
        )}
      </div>
    </div>
  );
}
