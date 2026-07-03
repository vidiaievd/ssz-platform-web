'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Eye, Star, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';

import type { ExpandedVocabItem } from '@/features/learning';
import { RefStrip, type RefStripParagraph } from '@/features/learning';
import { cn } from '@/lib/utils';

import type { SrsRating, VocabStudyQueueItem, VocabStudyResult } from './vocab-section-types';
import { VocabAudioBtn } from './vocab-audio-btn';
import { VocabTagPill } from './vocab-tag-pill';

/* ─── rating config ─────────────────────────────────────────────────────────── */

interface RatingDef {
  key: SrsRating;
  labelKey: 'ratingHard' | 'ratingGood' | 'ratingEasy';
  subKey: 'ratingHardSub' | 'ratingGoodSub' | 'ratingEasySub';
  icon: LucideIcon;
  bg: string;
  border: string;
  fg: string;
  iconColor: string;
  kb: string;
}

const RATINGS: RatingDef[] = [
  {
    key: 'hard',
    labelKey: 'ratingHard',
    subKey: 'ratingHardSub',
    icon: XCircle,
    bg: 'oklch(0.97 0.025 15)',
    border: 'oklch(0.88 0.07 15)',
    fg: 'oklch(0.44 0.105 15)',
    iconColor: 'oklch(0.54 0.18 15)',
    kb: '1',
  },
  {
    key: 'good',
    labelKey: 'ratingGood',
    subKey: 'ratingGoodSub',
    icon: CheckCircle,
    bg: 'oklch(0.95 0.03 168)',
    border: 'oklch(0.62 0.105 168 / 40%)',
    fg: 'oklch(0.44 0.09 168)',
    iconColor: 'var(--ssz-color-primary-500)',
    kb: '2',
  },
  {
    key: 'easy',
    labelKey: 'ratingEasy',
    subKey: 'ratingEasySub',
    icon: Star,
    bg: 'oklch(0.95 0.04 145)',
    border: 'oklch(0.76 0.11 145)',
    fg: 'oklch(0.44 0.11 145)',
    iconColor: 'oklch(0.50 0.12 145)',
    kb: '3',
  },
];

/* ─── VStudyCard ─────────────────────────────────────────────────────────────── */

interface VStudyCardProps {
  word: VocabStudyQueueItem;
  showExampleByDefault: boolean;
  onRate: (r: SrsRating) => void;
}

function VStudyCard({ word, showExampleByDefault, onRate }: VStudyCardProps) {
  const t = useTranslations('Learning.vocabSection');
  const [flipped, setFlipped]   = useState(false);
  const [showEx, setShowEx]     = useState(showExampleByDefault);

  useEffect(() => {
    void (async () => {
      setFlipped(false);
      setShowEx(showExampleByDefault);
    })();
  }, [word.id, showExampleByDefault]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === ' ' && !flipped) { e.preventDefault(); setFlipped(true); }
      if (e.key === '1' && flipped)  onRate('hard');
      if (e.key === '2' && flipped)  onRate('good');
      if (e.key === '3' && flipped)  onRate('easy');
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, onRate]);

  const CARD_H = 298;

  return (
    <div className="w-full">
      {/* 3D flip wrapper */}
      <div
        style={{ perspective: 1200, marginBottom: 14 }}
        onClick={!flipped ? () => setFlipped(true) : undefined}
        role="button"
        tabIndex={!flipped ? 0 : -1}
        aria-label={!flipped ? t('tapToReveal') : undefined}
        onKeyDown={(e) => { if (!flipped && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFlipped(true); } }}
        className={!flipped ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) rounded-[20px]' : 'cursor-default'}
      >
        <div
          style={{
            position: 'relative',
            height: CARD_H,
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'none',
            transition: 'transform 480ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* ── FRONT ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'var(--ssz-bg-surface)',
              borderRadius: 20,
              border: '1.5px solid var(--ssz-border-default)',
              boxShadow: 'var(--ssz-shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 11,
              padding: 28,
            }}
            aria-hidden={flipped}
          >
            <VocabTagPill pos={word.pos} />
            <p
              className="font-reading text-[46px] font-semibold leading-none text-(--ssz-text-primary)"
              style={{ letterSpacing: '-0.025em' }}
              lang="nb"
            >
              {word.word}
            </p>
            {word.ipa && (
              <p className="font-mono text-[14px] text-(--ssz-text-muted)">{word.ipa}</p>
            )}
            <VocabAudioBtn src={word.audioUrl} />
            <div
              className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-(--ssz-text-muted)"
              style={{ background: 'var(--ssz-bg-subtle)', marginTop: 4 }}
            >
              {t('tapToReveal')}
            </div>
          </div>

          {/* ── BACK ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--ssz-bg-surface)',
              borderRadius: 20,
              border: '2px solid oklch(0.62 0.105 168 / 45%)',
              boxShadow: 'var(--ssz-shadow-md), 0 0 0 5px oklch(0.95 0.03 168)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
              overflow: 'hidden',
            }}
            aria-hidden={!flipped}
          >
            {/* word + IPA + tag + audio row */}
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div>
                <span
                  className="font-reading text-[25px] font-semibold text-(--ssz-text-primary)"
                  style={{ marginRight: 10 }}
                  lang="nb"
                >
                  {word.word}
                </span>
                {word.ipa && (
                  <span className="font-mono text-[11.5px] text-(--ssz-text-muted)">{word.ipa}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <VocabTagPill pos={word.pos} />
                <VocabAudioBtn src={word.audioUrl} small />
              </div>
            </div>

            {/* Translation box */}
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: 'oklch(0.95 0.03 168)',
                border: '1.5px solid oklch(0.62 0.105 168 / 28%)',
              }}
            >
              <p
                className="mb-1 text-[10px] font-bold uppercase tracking-[0.07em]"
                style={{ color: 'oklch(0.44 0.09 168)' }}
              >
                {t('translation')}
              </p>
              <p
                className="text-[22px] font-bold"
                style={{ color: 'oklch(0.44 0.09 168)', letterSpacing: '-0.01em' }}
              >
                {word.translation}
              </p>
            </div>

            {/* Example sentence */}
            {word.example ? (
              showEx ? (
                <div
                  className="rounded-xl px-3.5 py-2.5"
                  style={{
                    background: 'var(--ssz-bg-subtle)',
                    border: '1.5px solid var(--ssz-border-default)',
                  }}
                >
                  <p
                    className="mb-1 text-[10px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)"
                  >
                    {t('fromTheText')}
                  </p>
                  <p
                    className="font-reading text-[14px] italic leading-[1.8] text-(--ssz-text-primary)"
                    lang="nb"
                  >
                    {word.example}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowEx(true); }}
                  className={cn(
                    'self-start inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
                    'text-[12px] font-semibold text-(--ssz-text-secondary)',
                    'border-(--ssz-border-default) bg-transparent hover:bg-subtle',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
                  )}
                  style={{ fontFamily: 'var(--ssz-font-ui)' }}
                >
                  <Eye size={13} aria-hidden="true" />
                  {t('showExample')}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Reveal / Rating buttons */}
      {!flipped ? (
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className={cn(
            'w-full rounded-[14px] border-2 py-3.5 text-[15px] font-bold text-white',
            'hover:brightness-105 active:brightness-95 transition-[filter]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          )}
          style={{
            borderColor: 'var(--ssz-color-primary-500)',
            background: 'var(--ssz-color-primary-500)',
            fontFamily: 'var(--ssz-font-ui)',
            transitionDuration: 'var(--ssz-duration-fast)',
          }}
        >
          {t('revealMeaning')}
        </button>
      ) : (
        <div>
          <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
            {t('howWell')}
          </p>
          <div className="flex gap-2">
            {RATINGS.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onRate(r.key)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-[13px] border py-3 px-2',
                    'cursor-pointer transition-[filter] hover:brightness-95 active:brightness-90',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
                  )}
                  style={{
                    background: r.bg,
                    borderColor: r.border,
                    fontFamily: 'var(--ssz-font-ui)',
                    transitionDuration: 'var(--ssz-duration-fast)',
                  }}
                >
                  <Icon size={20} style={{ color: r.iconColor }} aria-hidden="true" />
                  <span className="text-[13px] font-bold" style={{ color: r.fg }}>
                    {t(r.labelKey)}
                  </span>
                  <span className="text-[10.5px]" style={{ color: r.fg, opacity: 0.6 }}>
                    {r.kb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── VocabStudy ─────────────────────────────────────────────────────────────── */

export interface VocabStudyProps {
  newWords: ExpandedVocabItem[];
  refParagraphs: RefStripParagraph[];
  refTitle: string;
  onDone: (result: VocabStudyResult) => void;
}

export function VocabStudy({ newWords, refParagraphs, refTitle, onDone }: VocabStudyProps) {
  const t = useTranslations('Learning.vocabSection');

  const [queue, setQueue] = useState<VocabStudyQueueItem[]>(
    () => newWords.map((w) => ({ ...w, _hitCount: 0 })),
  );
  const [idx, setIdx]       = useState(0);
  const [refOpen, setRefOpen] = useState(false);

  const handleRate = useCallback(
    (rating: SrsRating) => {
      const cur = queue[idx];
      if (!cur) return;
      const nq = [...queue];
      if (rating === 'hard' && cur._hitCount < 2) {
        nq.push({ ...cur, _hitCount: cur._hitCount + 1 });
      }
      const next = idx + 1;
      if (next >= nq.length) {
        onDone({ studied: newWords.length });
      } else {
        setQueue(nq);
        setIdx(next);
      }
    },
    [queue, idx, newWords.length, onDone],
  );

  if (queue.length === 0) {
    return (
      <div
        className="flex w-full flex-col items-center gap-4 px-6"
        style={{ maxWidth: 420, paddingTop: 60, paddingBottom: 40 }}
      >
        <CheckCircle size={48} style={{ color: 'oklch(0.50 0.12 145)' }} aria-hidden="true" />
        <p className="text-[18px] font-bold text-(--ssz-text-primary)">{t('nothingToStudy')}</p>
        <button
          type="button"
          onClick={() => onDone({ studied: 0 })}
          className={cn(
            'rounded-xl px-8 py-3 text-[15px] font-bold text-white',
            'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          )}
        >
          {t('continueToGrammar')}
        </button>
      </div>
    );
  }

  const cur = queue[idx]!;
  const total = queue.length;

  return (
    <div className="w-full" style={{ maxWidth: 520, padding: '28px 24px 40px' }}>
      {/* RefStrip */}
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

      {/* Progress header */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
          {t('studyHeader', { current: idx + 1, total })}
        </p>
        {/* Dot pills */}
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                height: 5,
                width: i === idx ? 18 : 5,
                background: i <= idx ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)',
                opacity: i === idx ? 1 : i < idx ? 0.65 : 0.28,
                transition: 'all 250ms ease',
              }}
            />
          ))}
        </div>
      </div>

      <VStudyCard
        key={`${cur.id}_${String(cur._hitCount)}`}
        word={cur}
        showExampleByDefault={false}
        onRate={handleRate}
      />
    </div>
  );
}
