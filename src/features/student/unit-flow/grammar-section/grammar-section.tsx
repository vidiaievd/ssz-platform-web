'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ExpandedGrammarRule } from '@/features/learning';
import { BottomBar, type RefStripParagraph } from '@/features/learning';
import { cn } from '@/lib/utils';

import { GrammarRead } from './grammar-read';
import { GrammarEx, type GrammarQuickCheck } from './grammar-ex';

export interface GrammarSectionProps {
  rule?: ExpandedGrammarRule;
  /** Quick-check exercise derived from the grammar rule (optional). */
  exercise?: GrammarQuickCheck;
  refParagraphs: RefStripParagraph[];
  refTitle: string;
  /** Called when transitioning from grammar-read → grammar-ex (for phase persistence). */
  onExStart?: () => void;
  onContinue: () => void;
}

type GrammarInternalPhase = 'read' | 'ex';

export function GrammarSection({
  rule,
  exercise,
  refParagraphs,
  refTitle,
  onExStart,
  onContinue,
}: GrammarSectionProps) {
  const t = useTranslations('Learning.grammarSection');
  const [internalPhase, setInternalPhase] = useState<GrammarInternalPhase>('read');

  /* No grammar rule — show a skip placeholder */
  if (!rule) {
    return (
      <div
        className="flex w-full flex-col items-center px-6 pt-24 text-center"
        style={{ maxWidth: 420 }}
      >
        <p className="mb-2 text-[18px] font-bold text-(--ssz-text-primary)">{t('noRule')}</p>
        <p className="mb-8 text-[13.5px] leading-[1.65] text-(--ssz-text-secondary)">
          {t('noRuleBody')}
        </p>
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
            {t('ctaContinue')}
          </button>
        </BottomBar>
      </div>
    );
  }

  if (internalPhase === 'read') {
    return (
      <GrammarRead
        rule={rule}
        refParagraphs={refParagraphs}
        refTitle={refTitle}
        hasExercise={!!exercise}
        onContinue={() => {
          if (exercise) {
            onExStart?.();
            setInternalPhase('ex');
          } else {
            onContinue();
          }
        }}
      />
    );
  }

  if (internalPhase === 'ex' && exercise) {
    return <GrammarEx exercise={exercise} onContinue={onContinue} />;
  }

  return null;
}
