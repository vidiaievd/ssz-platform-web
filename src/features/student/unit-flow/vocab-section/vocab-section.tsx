'use client';

import { useState } from 'react';
import { CheckCircle, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ExpandedVocabItem } from '@/features/learning';
import type { RefStripParagraph } from '@/features/learning';
import { BottomBar } from '@/features/learning';
import { cn } from '@/lib/utils';

import type {
  VocabInternalPhase,
  VocabPassResult,
  VocabStats,
  VocabStudyResult,
} from './vocab-section-types';
import { VocabPass } from './vocab-pass';
import { VocabStudy } from './vocab-study';

export interface VocabSectionProps {
  vocab: ExpandedVocabItem[];
  /** Initial sub-phase — 'pass' when entering vocab for the first time; 'study' on refresh. */
  initialPhase?: 'pass' | 'study';
  refParagraphs: RefStripParagraph[];
  refTitle: string;
  /** Called when transitioning from pass → study so the parent can persist the phase. */
  onStudyStart?: () => void;
  /** Called when the whole vocab flow is complete (→ grammar). */
  onContinue: () => void;
}

export function VocabSection({
  vocab,
  initialPhase = 'pass',
  refParagraphs,
  refTitle,
  onStudyStart,
  onContinue,
}: VocabSectionProps) {
  const t = useTranslations('Learning.vocabSection');

  const [phase, setPhase]       = useState<VocabInternalPhase>(initialPhase);
  const [newWords, setNewWords] = useState<ExpandedVocabItem[]>([]);
  const [stats, setStats]       = useState<VocabStats | null>(null);

  function handlePassDone({ knownIds, newWords: nw }: VocabPassResult) {
    setNewWords(nw);
    if (nw.length === 0) {
      setPhase('all-known');
    } else {
      onStudyStart?.();
      setPhase('study');
    }
  }

  function handleStudyDone({ studied }: VocabStudyResult) {
    const knownCount = vocab.length - newWords.length;
    setStats({ total: vocab.length, known: knownCount, studied });
    setPhase('done');
  }

  /* ── All-known ── */
  if (phase === 'all-known') {
    return (
      <div
        className="flex w-full flex-col items-center px-6 text-center"
        style={{ maxWidth: 360, paddingTop: 72, paddingBottom: 60 }}
      >
        <div
          className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[24px]"
          style={{
            background: 'oklch(0.94 0.05 145)',
            border: '2px solid oklch(0.76 0.11 145)',
            boxShadow: '0 0 0 12px oklch(0.97 0.025 145)',
          }}
          aria-hidden="true"
        >
          <CheckCircle size={38} style={{ color: 'oklch(0.50 0.12 145)' }} />
        </div>
        <h2
          className="mb-2 text-[20px] font-bold text-(--ssz-text-primary)"
          style={{ letterSpacing: '-0.01em' }}
        >
          {t('allKnownTitle', { total: vocab.length })}
        </h2>
        <p className="mb-7 text-[13.5px] leading-[1.65] text-(--ssz-text-secondary)">
          {t('allKnownBody')}
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
            {t('continueToGrammar')}
          </button>
        </BottomBar>
      </div>
    );
  }

  /* ── Done ── */
  if (phase === 'done') {
    const s = stats ?? { total: vocab.length, known: 0, studied: vocab.length };
    return (
      <div
        className="flex w-full flex-col items-center px-6"
        style={{ maxWidth: 420, paddingTop: 52, paddingBottom: 60 }}
      >
        <div
          className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[24px]"
          style={{
            background: 'oklch(0.95 0.03 168)',
            border: '2px solid oklch(0.62 0.105 168 / 40%)',
            boxShadow: '0 0 0 12px oklch(0.95 0.03 168)',
          }}
          aria-hidden="true"
        >
          <Star size={38} style={{ color: 'var(--ssz-color-primary-500)' }} />
        </div>

        <h2
          className="mb-2 text-center text-[22px] font-bold text-(--ssz-text-primary)"
          style={{ letterSpacing: '-0.02em' }}
        >
          {t('doneTitle')}
        </h2>
        <p className="mb-6 text-center text-[13.5px] leading-[1.6] text-(--ssz-text-secondary)">
          {t('doneBody')}
        </p>

        {/* Stats row */}
        <div className="mb-6 flex w-full gap-3">
          {[
            { val: s.total,   labelKey: 'statWordsSeen',    color: 'var(--ssz-text-primary)' },
            { val: s.known,   labelKey: 'statAlreadyKnew',  color: 'oklch(0.50 0.12 145)' },
            { val: s.studied, labelKey: 'statStudiedToday', color: 'var(--ssz-color-primary-500)' },
          ].map((stat) => (
            <div
              key={stat.labelKey}
              className="flex flex-1 flex-col items-center rounded-[14px] border py-4 px-3 text-center"
              style={{
                background: 'var(--ssz-bg-surface)',
                borderColor: 'var(--ssz-border-default)',
                boxShadow: 'var(--ssz-shadow-xs)',
              }}
            >
              <span
                className="text-[28px] font-extrabold leading-none"
                style={{ color: stat.color, letterSpacing: '-0.03em' }}
              >
                {stat.val}
              </span>
              <span className="mt-1.5 text-[11.5px] font-semibold text-(--ssz-text-muted)">
                {t(stat.labelKey as Parameters<typeof t>[0])}
              </span>
            </div>
          ))}
        </div>

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
            {t('continueToGrammar')}
          </button>
        </BottomBar>
      </div>
    );
  }

  /* ── Study ── */
  if (phase === 'study') {
    const wordsToStudy = newWords.length > 0 ? newWords : [];
    return (
      <div className="flex w-full flex-col items-center">
        <VocabStudy
          newWords={wordsToStudy}
          refParagraphs={refParagraphs}
          refTitle={refTitle}
          onDone={handleStudyDone}
        />
      </div>
    );
  }

  /* ── Pass (default) ── */
  return (
    <div className="flex w-full flex-col items-center">
      <VocabPass words={vocab} onDone={handlePassDone} />
    </div>
  );
}
