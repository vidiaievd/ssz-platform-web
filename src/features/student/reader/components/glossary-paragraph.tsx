'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { GlossaryPopover } from '@/features/learning';
import type { PartOfSpeech } from '@/features/learning';
import { useMediaAsset } from '@/features/media';
import type { VocabularyItem } from '@/features/content/types';
import { cn } from '@/lib/utils';

import { tokenizeGlossary, type GlossaryIndex } from '../lib/tokenize-glossary';

const POS_TO_TAG: Record<string, PartOfSpeech> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj',
  adverb: 'adv',
  preposition: 'prep',
  conjunction: 'conj',
};

function toGlossaryTag(partOfSpeech?: string): PartOfSpeech {
  return (partOfSpeech && POS_TO_TAG[partOfSpeech]) || 'other';
}

function GlossaryWord({ text, item, contextSentence }: { text: string; item: VocabularyItem; contextSentence: string }) {
  const t = useTranslations('Learning.glossary');
  const locale = useLocale();
  const asset = useMediaAsset(item.audioMediaId);
  const translation = item.translations.find((tr) => tr.languageCode === locale) ?? item.translations[0];

  return (
    <GlossaryPopover
      word={item.lemma}
      pos={toGlossaryTag(item.partOfSpeech)}
      translation={translation?.translation ?? item.lemma}
      audioSrc={asset.data?.url}
      contextSentence={contextSentence}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${t('lookUpWord')}: ${text}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'cursor-pointer rounded-[3px] px-px',
          'underline decoration-dotted decoration-2 underline-offset-[3px]',
          'transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
        )}
        style={{
          textDecorationColor: 'oklch(0.62 0.105 168 / 70%)',
          transitionDuration: 'var(--ssz-duration-fast)',
        }}
      >
        {text}
      </span>
    </GlossaryPopover>
  );
}

export interface GlossaryParagraphProps {
  text: string;
  glossary: GlossaryIndex;
  /** BCP-47 language of `text`, for assistive tech / font selection. */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Renders `text` with glossary-marked words as tappable lookup popovers. */
export function GlossaryParagraph({ text, glossary, lang, className, style }: GlossaryParagraphProps) {
  const tokens = useMemo(() => tokenizeGlossary(text, glossary), [text, glossary]);

  return (
    <p
      lang={lang}
      className={cn('font-reading m-0 text-(--ssz-text-primary)', className)}
      style={{ textWrap: 'pretty', ...style } as React.CSSProperties}
    >
      {tokens.map((token) =>
        token.item ? (
          <GlossaryWord key={token.id} text={token.text} item={token.item} contextSentence={text} />
        ) : (
          <span key={token.id}>{token.text}</span>
        ),
      )}
    </p>
  );
}
