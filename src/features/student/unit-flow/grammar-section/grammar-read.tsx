'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ExpandedGrammarRule } from '@/features/learning';
import { BottomBar, RefStrip, type RefStripParagraph } from '@/features/learning';
import { cn } from '@/lib/utils';

export interface GrammarReadProps {
  rule: ExpandedGrammarRule;
  refParagraphs: RefStripParagraph[];
  refTitle: string;
  /** Whether there is a grammar exercise to do after this step. */
  hasExercise: boolean;
  onContinue: () => void;
}

export function GrammarRead({
  rule,
  refParagraphs,
  refTitle,
  hasExercise,
  onContinue,
}: GrammarReadProps) {
  const t = useTranslations('Learning.grammarSection');
  const [refOpen, setRefOpen] = useState(false);

  return (
    <div
      className="flex w-full flex-col"
      style={{ maxWidth: 580, padding: '28px 24px 120px' }}
    >
      {/* Reference strip */}
      {refParagraphs.length > 0 && (
        <div className="mb-5">
          <RefStrip
            title={refTitle}
            paragraphs={refParagraphs}
            open={refOpen}
            onToggle={() => setRefOpen((v) => !v)}
          />
        </div>
      )}

      {/* Eyebrow + title */}
      <p
        className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: 'oklch(0.44 0.09 168)' }}
      >
        {t('ruleLabel')}
      </p>
      <h2
        className="mb-5 text-[22px] font-bold leading-snug text-(--ssz-text-primary)"
        style={{ letterSpacing: '-0.02em' }}
      >
        {rule.title}
      </h2>

      {/* Explanation card */}
      <div
        className="mb-5 rounded-[14px] border px-5 py-4"
        style={{
          background: 'var(--ssz-bg-surface)',
          borderColor: 'var(--ssz-border-default)',
          boxShadow: 'var(--ssz-shadow-sm)',
        }}
      >
        <p className="text-[14.5px] leading-[1.75] text-(--ssz-text-primary)">
          {rule.explanation}
        </p>
      </div>

      {/* Examples */}
      {rule.examples.length > 0 && (
        <>
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-(--ssz-text-muted)">
            {t('examples')}
          </p>
          <div className="mb-7 flex flex-col gap-2.5">
            {rule.examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-[11px] border px-3.5 py-3"
                style={{
                  background: 'var(--ssz-bg-surface)',
                  borderColor: 'var(--ssz-border-default)',
                }}
              >
                <p
                  className="font-reading text-[15px] leading-[1.5] text-(--ssz-text-primary)"
                  lang="nb"
                >
                  {ex.target}
                </p>
                {ex.translation && (
                  <p className="mt-0.5 text-[12px] text-(--ssz-text-muted)">{ex.translation}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <BottomBar>
        <button
          type="button"
          onClick={onContinue}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-8 py-3',
            'text-[15px] font-bold text-white',
            'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            'transition-colors',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {hasExercise ? t('ctaPractise') : t('ctaContinue')}
        </button>
      </BottomBar>
    </div>
  );
}
