'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useIntroduceCard } from '@/features/content';

import { GlossaryPopover, type PartOfSpeech } from './glossary-popover';
import { useKnownWordsStore } from '../stores/known-words-store';
import { tokenizeGlossary, type GlossaryEntry, type GlossaryIndex } from '../lib/tokenize-glossary';
import { getGlossaryMode } from '../lib/glossary-mode';
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

/** Footer action of the full card — reports "known" to the SRS and fades the underline optimistically. */
function IKnowThisButton({ vocabularyItemId }: { vocabularyItemId: string }) {
  const t = useTranslations('Learning.glossary');
  const tErrors = useTranslations('Errors');
  const introduceCard = useIntroduceCard();
  const markKnown = useKnownWordsStore((s) => s.markKnown);
  const unmarkKnown = useKnownWordsStore((s) => s.unmarkKnown);

  function handleClick() {
    markKnown(vocabularyItemId);
    introduceCard.mutate(
      { contentType: 'VOCABULARY_WORD', contentId: vocabularyItemId, seedKind: 'CLAIMED_KNOWN' },
      {
        onError: () => {
          unmarkKnown(vocabularyItemId);
          toast.error(tErrors('unknown'));
        },
      },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={introduceCard.isPending}
      className="w-full text-left text-xs font-semibold text-(--ssz-color-primary-600) disabled:opacity-50"
    >
      {t('iKnowThis')}
    </button>
  );
}

function GlossaryWord({
  text,
  entry,
  contextSentence,
  cefrLevel,
  children,
}: {
  text: string;
  entry: GlossaryEntry;
  contextSentence: string;
  cefrLevel?: string;
  children: ReactNode;
}) {
  const t = useTranslations('Learning.glossary');
  const locale = useLocale();
  const { item } = entry;
  const translation = item.translations.find((tr) => tr.languageCode === locale) ?? item.translations[0];
  const known = useKnownWordsStore((s) => s.known.has(item.id));
  const mode = getGlossaryMode(cefrLevel ?? '');
  const displayText =
    mode === 'definition'
      ? translation?.definition || translation?.translation || item.lemma
      : (translation?.translation ?? item.lemma);

  return (
    <GlossaryPopover
      word={item.lemma}
      phonetic={item.ipa}
      pos={toGlossaryTag(item.partOfSpeech)}
      translation={displayText}
      audioMediaId={item.audioMediaId}
      forms={item.forms}
      form={entry.form}
      formLabel={entry.formLabel}
      contextSentence={contextSentence}
      footer={<IKnowThisButton vocabularyItemId={item.id} />}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${t('lookUpWord')}: ${text}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'cursor-pointer rounded-[3px] px-px',
          !known && 'underline decoration-dotted decoration-2 underline-offset-[3px]',
          'transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
        )}
        style={{
          textDecorationColor: known ? undefined : 'oklch(0.62 0.105 168 / 70%)',
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
  /** Reader's CEFR level — selects translation vs. target-language definition (B2+). */
  cefrLevel?: string;
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
export function GlossaryText({ text: raw, glossary, cefrLevel }: GlossaryTextProps) {
  const { text, marks } = useMemo(() => parseInlineMarkdown(raw), [raw]);
  const tokens = useMemo(() => tokenizeGlossary(text, glossary), [text, glossary]);

  return (
    <>
      {tokens.map((token) => {
        const pieces = sliceMarks(marks, token.start, token.start + token.text.length).map((piece) => (
          <Fragment key={piece.start}>{withEmphasis(text.slice(piece.start, piece.end), piece.kinds)}</Fragment>
        ));

        return token.entry ? (
          <GlossaryWord
            key={token.id}
            text={token.text}
            entry={token.entry}
            contextSentence={text}
            cefrLevel={cefrLevel}
          >
            {pieces}
          </GlossaryWord>
        ) : (
          <Fragment key={token.id}>{pieces}</Fragment>
        );
      })}
    </>
  );
}
