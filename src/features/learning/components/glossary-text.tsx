'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useIntroduceCard } from '@/features/content';
import type { LessonTextSpan, VocabularyItem } from '@/features/content/types';

import { GlossaryPopover, type PartOfSpeech } from './glossary-popover';
import { SpanAnnotation } from './span-annotation';
import { useGlossIntensity } from './gloss-intensity-provider';
import { learningKeys } from '../api/keys';
import type { GlossIntensity } from '../lib/gloss-intensity';
import { tokenizeGlossary, type GlossaryEntry, type GlossaryIndex } from '../lib/tokenize-glossary';
import { getGlossaryMode } from '../lib/glossary-mode';
import { parseInlineMarkdown, sliceMarks, type InlineMarkKind } from '../lib/parse-inline-markdown';
import { projectRange, type ProjectedSpan } from '../lib/project-span';
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

/**
 * Layering order for author spans (spec 16 §3.2): a chunk is the backdrop, a
 * grammar fill sits on it, a lexis underline on top. Rendered as nesting in
 * this order, so a span that only partly overlaps a higher-priority one is cut
 * at its boundary. Sane authoring nests; partial overlap is pathological and
 * degrades to a visual seam rather than to lost text.
 */
const SPAN_LAYERS = ['chunk', 'grammar', 'vocab'] as const;

/**
 * Backdrops for the two kinds that are not lexis. Both are painted with
 * `color-mix` against the theme-invariant hue token, so they hold up in light
 * and dark without a second value; `box-decoration-break: clone` keeps the
 * rounding on every line box when a chunk wraps.
 *
 * Chunk sits deeper than grammar because it is the outer layer: at equal
 * strength the nested fill would vanish into it.
 */
const SPAN_FILL: Record<'grammar' | 'chunk', string> = {
  grammar: 'color-mix(in oklch, var(--ssz-type-grammar) 15%, transparent)',
  chunk: 'color-mix(in oklch, var(--ssz-type-chunk) 22%, transparent)',
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
  /**
   * Author annotations placed on this run, in the coordinates of `text` —
   * i.e. before emphasis delimiters are stripped. `LessonProse` produces them
   * with `projectSpansOntoBlocks`; this component does the second projection
   * onto the string it renders.
   */
  spans?: ProjectedSpan<LessonTextSpan>[];
  /**
   * The variant has authored vocabulary spans, so the tokenizer is off for the
   * whole text (spec 16 §5.3). Decided per variant by the page, not per run: a
   * paragraph with no spans of its own must not fall back to matching while its
   * neighbours use the author's marks.
   */
  authoredVocabulary?: boolean;
  /**
   * Gloss visibility is `off`. Grammar and chunk spans are not SRS-tracked and
   * have no intensity to fade, so they are hidden outright; lexis keeps going
   * through `useGlossIntensity`, which drops it to an undecorated but still
   * clickable word.
   */
  spansHidden?: boolean;
  /**
   * BCP-47 language for grammar explanations, fetched when a grammar
   * annotation is opened. Without it the popover shows the rule title alone.
   */
  explanationLanguage?: string;
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
export function GlossaryText({
  text: raw,
  glossary,
  cefrLevel,
  spans,
  authoredVocabulary = false,
  spansHidden = false,
  explanationLanguage,
}: GlossaryTextProps) {
  const { text, marks, sourceIndexOf } = useMemo(() => parseInlineMarkdown(raw), [raw]);
  // Spans and the tokenizer are alternatives, never both (spec 16 §5.3).
  const tokens = useMemo(
    () => (authoredVocabulary ? [] : tokenizeGlossary(text, glossary)),
    [text, glossary, authoredVocabulary],
  );
  // Segmented once per paragraph, then looked up by token offset: the popover
  // quotes the sentence the word sits in, not the whole paragraph.
  const sentences = useMemo(() => splitSentences(text), [text]);
  // A vocab span names its vocabulary item by id, while the glossary index is
  // keyed by surface form; §5.2 guarantees the item is in this variant's marks.
  const itemsById = useMemo(() => {
    const byId = new Map<string, VocabularyItem>();
    for (const entry of glossary.values()) byId.set(entry.item.id, entry.item);
    return byId;
  }, [glossary]);

  /** The spans of this run, projected onto the emphasis-stripped string. */
  const placed = useMemo(() => {
    if (!spans?.length) return [];
    const out: ProjectedSpan<LessonTextSpan>[] = [];
    for (const { span, start, end } of spans) {
      if (spansHidden && span.kind !== 'vocab') continue;
      const hit = projectRange(sourceIndexOf, start, end);
      // Covers markup only — nothing to draw on (spec 16 §2.3).
      if (hit) out.push({ span, ...hit });
    }
    return out;
  }, [spans, sourceIndexOf, spansHidden]);

  /** Emphasis runs of `[from, to)`, the innermost thing rendered either way. */
  function emphasised(from: number, to: number): ReactNode[] {
    return sliceMarks(marks, from, to).map((piece) => (
      <Fragment key={piece.start}>{withEmphasis(text.slice(piece.start, piece.end), piece.kinds)}</Fragment>
    ));
  }

  /**
   * Innermost layer: tokenizer matches, clipped to `[from, to)`. Clipping can
   * cut a matched word where a grammar or chunk boundary falls inside it,
   * yielding two lookups for one word — the same seam a partial overlap makes,
   * and preferable to dropping the match.
   */
  function renderLeaf(from: number, to: number): ReactNode[] {
    const out: ReactNode[] = [];
    let covered = false;

    for (const token of tokens) {
      const start = Math.max(token.start, from);
      const end = Math.min(token.start + token.text.length, to);
      if (end <= start) continue;
      covered = true;
      out.push(
        token.entry ? (
          <GlossaryWord
            key={`t${start}`}
            text={text.slice(start, end)}
            entry={token.entry}
            contextSentence={sentenceAt(sentences, token.start)}
            cefrLevel={cefrLevel}
          >
            {emphasised(start, end)}
          </GlossaryWord>
        ) : (
          <Fragment key={`t${start}`}>{emphasised(start, end)}</Fragment>
        ),
      );
    }

    return covered ? out : [<Fragment key={`p${from}`}>{emphasised(from, to)}</Fragment>];
  }

  /** Wraps `[from, to)` in the decoration of one span, or renders it plainly. */
  function renderSpan(
    projected: ProjectedSpan<LessonTextSpan>,
    from: number,
    to: number,
    depth: number,
  ): ReactNode {
    const { span } = projected;
    const key = `${span.id}-${from}`;
    const children = renderLayer(from, to, depth + 1);

    if (span.kind === 'vocab') {
      const item = span.refId ? itemsById.get(span.refId) : undefined;
      // The word is annotated but absent from this unit's vocabulary list, so
      // there is no card to open. Nothing to show beats an empty popover.
      if (!item) return <Fragment key={key}>{children}</Fragment>;
      const surface = text.slice(from, to);
      const form = item.forms?.find((f) => f.value?.toLowerCase() === surface.toLowerCase());
      return (
        <GlossaryWord
          key={key}
          text={surface}
          entry={{ item, form: form?.value ?? surface, formLabel: form?.label ?? null }}
          contextSentence={sentenceAt(sentences, from)}
          cefrLevel={cefrLevel}
        >
          {children}
        </GlossaryWord>
      );
    }

    // A chunk with no note explains nothing, so it gets no marker — the
    // backdrop alone still tells the reader the words belong together.
    const hasAnnotation = span.kind === 'grammar' ? !!span.refId || !!span.note : !!span.note;

    return (
      <Fragment key={key}>
        <span
          data-span-kind={span.kind}
          className="rounded-xs px-0.5"
          style={{ background: SPAN_FILL[span.kind], boxDecorationBreak: 'clone' }}
        >
          {children}
        </span>
        {hasAnnotation && (
          <SpanAnnotation
            kind={span.kind}
            surface={text.slice(from, to)}
            note={span.note}
            refId={span.refId}
            explanationLanguage={explanationLanguage}
            cefrLevel={cefrLevel}
          />
        )}
      </Fragment>
    );
  }

  /**
   * Walks the layers in priority order, emitting each span of the current layer
   * around a recursive render of the layers below it. Clipping to `[from, to)`
   * is what splits a lower-priority span at a higher one's boundary.
   */
  function renderLayer(from: number, to: number, depth: number): ReactNode[] {
    if (from >= to) return [];
    if (depth >= SPAN_LAYERS.length) return renderLeaf(from, to);

    const kind = SPAN_LAYERS[depth];
    const layer = placed.filter((p) => p.span.kind === kind && p.end > from && p.start < to);

    const out: ReactNode[] = [];
    let cursor = from;
    for (const projected of layer) {
      const start = Math.max(projected.start, cursor);
      const end = Math.min(projected.end, to);
      // Same-kind spans are disjoint by the service's overlap rule; this only
      // guards against a duplicate that escaped it.
      if (end <= start) continue;
      if (start > cursor) out.push(...renderLayer(cursor, start, depth + 1));
      out.push(renderSpan(projected, start, end, depth));
      cursor = end;
    }
    if (cursor < to) out.push(...renderLayer(cursor, to, depth + 1));
    return out;
  }

  return <>{renderLayer(0, text.length, 0)}</>;
}
