'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { VocabularyItem } from '@/features/content/types';

import { WordAudioButton, posMeta, type VocabCardMode } from './vocab-flip-card';

export interface VocabWordListProps {
  items: VocabularyItem[];
  cardMode: VocabCardMode;
  /** Language of the words, for the pronunciation voice. */
  lang: string;
}

/**
 * The reference half of the vocabulary page: everything visible at once, in one
 * scannable column. The flow teaches; this is what a learner comes back to
 * mid-text, and a dense row serves that better than a card that must be flipped.
 */
export function VocabWordList({ items, cardMode, lang }: VocabWordListProps) {
  const t = useTranslations('Learning.reader.vocab');
  const locale = useLocale();

  return (
    <ul className="divide-y divide-(--ssz-border-default) overflow-hidden rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface">
      {items.map((item) => {
        const translation =
          item.translations.find((tr) => tr.languageCode === locale) ?? item.translations[0];
        const meaning =
          cardMode === 'definition'
            ? (translation?.definition ?? translation?.translation)
            : translation?.translation;
        const { bg, fg } = posMeta(item.partOfSpeech);
        const posKey = `pos.${item.partOfSpeech ?? 'other'}` as Parameters<typeof t>[0];
        const posLabel = t.has(posKey) ? t(posKey) : (item.partOfSpeech ?? t('pos.other'));

        return (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <WordAudioButton word={item.lemma} mediaId={item.audioMediaId} lang={lang} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-reading text-[17px] font-semibold text-(--ssz-text-primary)">
                  {item.lemma}
                </span>
                {item.ipa && <span className="font-mono text-[11px] text-(--ssz-text-muted)">{item.ipa}</span>}
              </div>
              <div className="text-[13.5px] text-(--ssz-text-secondary)">{meaning ?? '—'}</div>
            </div>
            <span
              className="inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: bg, color: fg }}
            >
              {posLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
