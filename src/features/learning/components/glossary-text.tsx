'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useIntroduceCard } from '@/features/content';

import { GlossaryPopover, type PartOfSpeech } from './glossary-popover';
import { useGlossIntensity } from './gloss-intensity-provider';
import { learningKeys } from '../api/keys';
import type { GlossIntensity } from '../lib/gloss-intensity';
import { tokenizeGlossary, type GlossaryEntry, type GlossaryIndex } from '../lib/tokenize-glossary';
import { getGlossaryMode } from '../lib/glossary-mode';
import { parseInlineMarkdown, sliceMarks, type InlineMarkKind } from '../lib/parse-inline-markdown';
import { sentenceAt, splitSentences } from '../lib/split-sentences';

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

/**
 * Underline per gloss intensity. Only weight and opacity vary — hue stays put,
 * because colour is reserved for the gloss *kind* (lexis / grammar / chunk) in
 * plan 31 phase D.
 *
 * `muted` fades the decoration through its own alpha rather than the span's
 * `opacity`, which would dim the word itself and hurt reading.
 */
const DECORATION: Record<GlossIntensity, { className: string; color?: string }> = {
  strong: {
    // Thicker as well as solid: at an identical 2px the solid/dotted contrast
    // alone reads as a texture change rather than as more urgency.
    className: 'underline decoration-solid decoration-[3px] underline-offset-[3px]',
    color: 'oklch(0.62 0.105 168 / 85%)',
  },
  normal: {
    className: 'underline decoration-dotted decoration-2 underline-offset-[3px]',
    color: 'oklch(0.62 0.105 168 / 70%)',
  },
  muted: {
    className: 'underline decoration-dotted decoration-2 underline-offset-[3px]',
    color: 'oklch(0.62 0.105 168 / 25%)',
  },
  // Undecorated, but still a lookup target — the word stays clickable.
  none: { className: '' },
};

/** Wraps a run in its emphasis elements, innermost last so `strong > em` nests correctly. */
function withEmphasis(content: ReactNode, kinds: InlineMarkKind[]): ReactNode {
  let node = content;
  if (kinds.includes('em')) node = <em>{node}</em>;
  if (kinds.includes('strong')) node = <strong className="font-semibold">{node}</strong>;
  return node;
}

/**
 * Footer action of the full card — seeds an SRS card for the word. The underline
 * then fades out of the refetched card states rather than from local optimism,
 * so what the reader sees is what the scheduler actually recorded.
 */
function IKnowThisButton({ vocabularyItemId }: { vocabularyItemId: string }) {
  const t = useTranslations('Learning.glossary');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const introduceCard = useIntroduceCard();

  function handleClick() {
    introduceCard.mutate(
      { contentType: 'VOCABULARY_WORD', contentId: vocabularyItemId, seedKind: 'CLAIMED_KNOWN' },
      {
        // Empty id list yields the key prefix shared by every card-states query,
        // so the batch this word belongs to is refetched whichever text it is in.
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: learningKeys.srsCardStates('VOCABULARY_WORD', []),
          }),
        onError: () => toast.error(tErrors('unknown')),
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
  const intensity = useGlossIntensity(item.id);
  const decoration = DECORATION[intensity];
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
          decoration.className,
          'transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
        )}
        style={{
          textDecorationColor: decoration.color,
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
  // Segmented once per paragraph, then looked up by token offset: the popover
  // quotes the sentence the word sits in, not the whole paragraph.
  const sentences = useMemo(() => splitSentences(text), [text]);

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
            contextSentence={sentenceAt(sentences, token.start)}
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
