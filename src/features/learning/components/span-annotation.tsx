'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBestGrammarExplanation, useGrammarRule } from '@/features/content';
import { cn } from '@/lib/utils';

import { parseInlineMarkdown } from '../lib/parse-inline-markdown';

/** The two span kinds that carry an explanation rather than a dictionary entry. */
export type AnnotationKind = 'grammar' | 'chunk';

const HUE: Record<AnnotationKind, string> = {
  grammar: 'var(--ssz-type-grammar)',
  chunk: 'var(--ssz-type-chunk)',
};

/**
 * A grammar explanation is authored per language and per level and can run to
 * several paragraphs. The reader gets the first one: enough to recognise which
 * rule is at work in the sentence in front of them, without turning a lookup
 * into a lesson. The rest — compare examples, the quick check — belongs to the
 * grammar lesson, and a mini-exercise inside a reading popover would interrupt
 * exactly the pass through the text this whole phase exists to protect.
 */
function firstParagraph(body: string): string {
  const [first = ''] = body.split(/\n\s*\n/);
  // Emphasis delimiters would otherwise show up verbatim in the popover.
  return parseInlineMarkdown(first.trim()).text;
}

function GrammarBody({
  ruleId,
  explanationLanguage,
  cefrLevel,
}: {
  ruleId: string;
  explanationLanguage?: string;
  cefrLevel?: string;
}) {
  const t = useTranslations('Learning.glossary');
  const tCommon = useTranslations('Common');
  // Mounted only once the popover is open, so a paragraph full of grammar spans
  // costs no requests until the reader asks — as `GlossaryAudio` does for media.
  const rule = useGrammarRule(ruleId);
  const explanation = useBestGrammarExplanation(
    ruleId,
    explanationLanguage ?? '',
    cefrLevel ?? '',
    !!explanationLanguage && !!cefrLevel,
  );

  if (rule.isLoading) {
    return <p className="text-xs text-(--ssz-text-muted)">{tCommon('loading')}</p>;
  }
  if (!rule.data) {
    return <p className="text-xs text-(--ssz-text-muted)">{t('ruleUnavailable')}</p>;
  }

  return (
    <>
      <p className="text-sm font-semibold text-(--ssz-text-primary)">{rule.data.title}</p>
      {explanation.data?.body && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-(--ssz-text-secondary)">
          {firstParagraph(explanation.data.body)}
        </p>
      )}
    </>
  );
}

export interface SpanAnnotationProps {
  kind: AnnotationKind;
  /** The annotated words, quoted back as the popover's subject. */
  surface: string;
  /** Author note. The whole content for a chunk; an addition for grammar. */
  note?: string | null;
  /** Grammar rule id, resolved only when the popover opens. */
  refId?: string | null;
  /** BCP-47 language of the grammar explanation to fetch. */
  explanationLanguage?: string;
  /** Reader's CEFR level — grammar explanations are authored per level. */
  cefrLevel?: string;
}

/**
 * The footnote marker that opens a grammar or chunk annotation.
 *
 * It sits *after* the annotated words rather than on them, and the backdrop
 * itself stays inert. A chunk routinely contains glossed words, and making the
 * backdrop the trigger would nest one interactive element inside another —
 * invalid, unreachable by keyboard in the expected order, and ambiguous to a
 * screen reader about which annotation a click means. A sibling marker keeps
 * every interactive element in the paragraph flat, and gives the backdrop the
 * affordance it otherwise lacks: coloured text alone never says that there is
 * something to open.
 *
 * Click only, deliberately. The hover-preview of `GlossaryPopover` exists to
 * protect the noticing effect for lexis — decision D1 of plan 31 withholds the
 * translation until the reader asks. A chunk note or a rule title has nothing
 * to withhold, so a second interaction model would cost the reader attention
 * and buy nothing.
 */
export function SpanAnnotation({
  kind,
  surface,
  note,
  refId,
  explanationLanguage,
  cefrLevel,
}: SpanAnnotationProps) {
  const t = useTranslations('Learning.glossary');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={kind === 'grammar' ? t('showRule') : t('showNote')}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'mx-0.5 inline-block h-1.75 w-1.75 shrink-0 cursor-pointer rounded-full align-super',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          )}
          style={{ background: HUE[kind] }}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        style={{ background: 'var(--ssz-bg-surface)', border: '1px solid var(--ssz-border-default)' }}
      >
        <span
          className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
          style={{
            background: `color-mix(in oklch, ${HUE[kind]} 16%, transparent)`,
            color: HUE[kind],
          }}
        >
          {kind === 'grammar' ? t('grammarKind') : t('chunkKind')}
        </span>
        <p className="font-reading mb-2 text-[15px] leading-snug font-semibold text-(--ssz-text-primary)">
          {surface}
        </p>
        {/* The author's own words come first: a note written on this occurrence
            is more specific than the rule it illustrates. */}
        {note && <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{note}</p>}
        {kind === 'grammar' && refId && (
          <div className={cn(note && 'mt-2 border-t border-(--ssz-border-default) pt-2')}>
            <GrammarBody
              ruleId={refId}
              explanationLanguage={explanationLanguage}
              cefrLevel={cefrLevel}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
