'use client';

import { ArrowRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { useBestGrammarExplanation, useGrammarRule } from '@/features/content';
import { cn } from '@/lib/utils';

import { parseInlineMarkdown } from '../lib/parse-inline-markdown';
import { useGrammarLink } from './grammar-link-provider';
import { HighlightedSentence } from './highlighted-sentence';
import { ANNOTATION_HUE } from './span-annotation';
import {
  useSelectedAnnotationStore,
  type SelectedAnnotation,
} from '../stores/selected-annotation-store';

export interface AnnotationCardPanelProps {
  /** BCP-47 language of the grammar explanation to fetch. */
  explanationLanguage?: string;
  /** Reader's CEFR level — grammar explanations are authored per level. */
  cefrLevel?: string;
  className?: string;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10.5px] font-bold tracking-wide text-(--ssz-text-muted) uppercase">
      {children}
    </h3>
  );
}

/**
 * The gist of the rule, in one or two sentences.
 *
 * The authored `summary` is what this is for. The fallback is the body's first
 * paragraph, stripped of emphasis markers — worth having because a rule may
 * predate the summary field, but only ever a fallback: a body written for a
 * page opens with a heading and runs into tables of forms, and neither belongs
 * in a card the reader is meant to glance at and return to the sentence.
 */
function gistOf(explanation: { summary?: string | null; body: string } | undefined): string {
  if (!explanation) return '';
  if (explanation.summary?.trim()) return explanation.summary.trim();

  const paragraph = explanation.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith('#'));
  return paragraph ? parseInlineMarkdown(paragraph).text : '';
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
  // Absent for a rule the reader cannot reach — one in another course, or in
  // none. The card then simply ends, rather than offering a link into nothing.
  const ruleHref = useGrammarLink(ruleId);
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

  const gist = gistOf(explanation.data);
  const anchorText = explanation.data?.anchorText;

  return (
    <section>
      <SectionHeading>{t('ruleCardTitle')}</SectionHeading>
      <p className="text-[15px] leading-snug font-semibold text-(--ssz-text-primary)">
        {rule.data.title}
      </p>
      {gist && (
        <p className="mt-2 text-[13px] leading-relaxed text-(--ssz-text-secondary)">{gist}</p>
      )}
      {/* One worked example beats a paragraph about the rule: it is the fastest
          way to recognise the same shape in the sentence just clicked. */}
      {anchorText && (
        <p
          className="font-reading mt-2.5 rounded-xl bg-(--ssz-bg-subtle) px-3 py-2.5 text-[13.5px] leading-relaxed text-(--ssz-text-primary)"
          lang={rule.data.targetLanguage || undefined}
        >
          <HighlightedSentence
            sentence={anchorText}
            highlights={explanation.data?.anchorHighlights ?? []}
            intensity={18}
          />
        </p>
      )}
      {ruleHref && (
        <Link
          href={ruleHref}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-(--ssz-text-link) hover:underline"
        >
          {t('openRule')}
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function Card({
  selected,
  explanationLanguage,
  cefrLevel,
  onClose,
}: {
  selected: SelectedAnnotation;
  explanationLanguage?: string;
  cefrLevel?: string;
  onClose: () => void;
}) {
  const t = useTranslations('Learning.glossary');
  const { kind, surface, note, refId } = selected;
  const hue = ANNOTATION_HUE[kind];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span
            className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
            style={{ background: `color-mix(in oklch, ${hue} 16%, transparent)`, color: hue }}
          >
            {kind === 'grammar' ? t('grammarKind') : t('chunkKind')}
          </span>
          <p className="font-reading text-[17px] leading-tight font-semibold break-words text-(--ssz-text-primary)">
            {surface}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeCard')}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-(--ssz-text-muted) hover:bg-subtle focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* The author's own words come first: a note written on this occurrence is
          more specific than the rule it illustrates. */}
      {note && <p className="text-sm leading-relaxed text-(--ssz-text-primary)">{note}</p>}

      {kind === 'grammar' && refId && (
        <GrammarBody
          ruleId={refId}
          explanationLanguage={explanationLanguage}
          cefrLevel={cefrLevel}
        />
      )}
    </div>
  );
}

/**
 * The rail's annotation card: what `SpanAnnotation`'s popover shows, moved out
 * of the prose wherever the reader is wide enough to hold it.
 *
 * Same trade as the word card — the sentence stays uncovered, and the rule gets
 * room for its own example instead of a clipped paragraph.
 *
 * Renders nothing until an annotation is opened: the rail's resting state is
 * the word card, which this one replaces for as long as it is open (see
 * [useSelectedAnnotationStore]). So there is no empty state here — an empty
 * card and an empty word card stacked would be two invitations to click the
 * same text.
 */
export function AnnotationCardPanel({
  explanationLanguage,
  cefrLevel,
  className,
}: AnnotationCardPanelProps) {
  const selected = useSelectedAnnotationStore((s) => s.selected);
  const clear = useSelectedAnnotationStore((s) => s.clear);

  if (!selected) return null;

  return (
    <div className={cn('border-t border-(--ssz-border-default)', className)}>
      <Card
        // Remounts per annotation, so a card opened while another rule's
        // explanation is still loading never shows the previous one's body.
        key={`${selected.surface}:${selected.refId ?? 'chunk'}`}
        selected={selected}
        explanationLanguage={explanationLanguage}
        cefrLevel={cefrLevel}
        onClose={clear}
      />
    </div>
  );
}
