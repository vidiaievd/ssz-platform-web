'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { GlossaryPopover, type PartOfSpeech } from './glossary-popover';
import { tokenizeGlossary, type GlossaryEntry, type GlossaryIndex } from '../lib/tokenize-glossary';
import { parseInlineMarkdown, sliceMarks, type InlineMarkKind } from '../lib/parse-inline-markdown';

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

/** Wraps a run in its emphasis elements, innermost last so `strong > em` nests correctly. */
function withEmphasis(content: ReactNode, kinds: InlineMarkKind[]): ReactNode {
  let node = content;
  if (kinds.includes('em')) node = <em>{node}</em>;
  if (kinds.includes('strong')) node = <strong className="font-semibold">{node}</strong>;
  return node;
}

function GlossaryWord({
  text,
  entry,
  contextSentence,
  children,
}: {
  text: string;
  entry: GlossaryEntry;
  contextSentence: string;
  children: ReactNode;
}) {
  const t = useTranslations('Learning.glossary');
  const locale = useLocale();
  const { item } = entry;
  const translation = item.translations.find((tr) => tr.languageCode === locale) ?? item.translations[0];

  return (
    <GlossaryPopover
      word={item.lemma}
      phonetic={item.ipa}
      pos={toGlossaryTag(item.partOfSpeech)}
      translation={translation?.translation ?? item.lemma}
      audioMediaId={item.audioMediaId}
      forms={item.forms}
      form={entry.form}
      formLabel={entry.formLabel}
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
        {children}
      </span>
    </GlossaryPopover>
  );
}

export interface GlossaryTextProps {
  /** Inline markdown. Emphasis delimiters are stripped before glossary matching. */
  text: string;
  glossary: GlossaryIndex;
}

/**
 * Renders one run of lesson prose: markdown emphasis and glossary lookups over
 * the same string.
 *
 * Both layers segment the text independently, so they are merged by offset —
 * the glossary token is the outer unit (one popover per matched word) and
 * emphasis is applied to the runs inside it. A word that is only partly
 * emphasised therefore stays a single lookup target.
 */
export function GlossaryText({ text: raw, glossary }: GlossaryTextProps) {
  const { text, marks } = useMemo(() => parseInlineMarkdown(raw), [raw]);
  const tokens = useMemo(() => tokenizeGlossary(text, glossary), [text, glossary]);

  return (
    <>
      {tokens.map((token) => {
        const pieces = sliceMarks(marks, token.start, token.start + token.text.length).map((piece) => (
          <Fragment key={piece.start}>{withEmphasis(text.slice(piece.start, piece.end), piece.kinds)}</Fragment>
        ));

        return token.entry ? (
          <GlossaryWord key={token.id} text={token.text} entry={token.entry} contextSentence={text}>
            {pieces}
          </GlossaryWord>
        ) : (
          <Fragment key={token.id}>{pieces}</Fragment>
        );
      })}
    </>
  );
}
