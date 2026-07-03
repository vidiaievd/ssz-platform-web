'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ExpandedVocabItem } from '@/features/learning';
import { cn } from '@/lib/utils';

import type { VocabPassResult, VocabQueueItem } from './vocab-section-types';
import { VocabAudioBtn } from './vocab-audio-btn';
import { VocabTagPill } from './vocab-tag-pill';

export interface VocabPassProps {
  words: ExpandedVocabItem[];
  onDone: (result: VocabPassResult) => void;
}

export function VocabPass({ words, onDone }: VocabPassProps) {
  const t = useTranslations('Learning.vocabSection');

  const [queue, setQueue]       = useState<VocabQueueItem[]>(() => words.map((w) => ({ ...w })));
  const [idx, setIdx]           = useState(0);
  const [knownIds, setKnownIds] = useState<Set<string>>(() => new Set());
  const [newIds, setNewIds]     = useState<Set<string>>(() => new Set());
  const [exiting, setExiting]   = useState<'know' | 'new' | null>(null);
  const knownCountRef = useRef(0);

  const item = queue[idx];

  const advance = useCallback(
    (isKnown: boolean) => {
      if (exiting || !item) return;

      setExiting(isKnown ? 'know' : 'new');

      const nk = new Set(knownIds);
      const nn = new Set(newIds);
      if (isKnown) {
        nk.add(item.id);
        knownCountRef.current += 1;
      } else {
        nk.delete(item.id);
        nn.add(item.id);
      }
      setKnownIds(nk);
      setNewIds(nn);

      // Every 3rd "know" → splice a confirmation re-check into the queue
      let nq = [...queue];
      if (isKnown && knownCountRef.current % 3 === 0) {
        const pool = [...nk].filter((id) => id !== item.id);
        if (pool.length > 0) {
          const recheckId = pool[Math.floor(Math.random() * pool.length)]!;
          const recheckWord = words.find((w) => w.id === recheckId);
          if (recheckWord) {
            const at = Math.min(idx + 2, nq.length);
            nq = [
              ...nq.slice(0, at),
              { ...recheckWord, isCheck: true, _uid: Date.now() },
              ...nq.slice(at),
            ];
          }
        }
      }

      setTimeout(() => {
        setExiting(null);
        const next = idx + 1;
        if (next >= nq.length) {
          onDone({ knownIds: nk, newWords: words.filter((w) => nn.has(w.id)) });
        } else {
          setQueue(nq);
          setIdx(next);
        }
      }, 240);
    },
    [exiting, item, queue, idx, knownIds, newIds, words, onDone],
  );

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft'  || e.key === 'k' || e.key === 'K') advance(true);
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') advance(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance]);

  if (!item) return null;

  const progress = (idx / Math.max(queue.length, 1)) * 100;

  return (
    <div
      className="flex w-full flex-col items-center"
      style={{ maxWidth: 440, padding: '36px 24px 52px' }}
    >
      {/* Eyebrow */}
      <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
        {t('passHeader')}
      </p>

      {/* Progress bar */}
      <div className="mb-8 flex w-full items-center gap-2.5">
        <div
          className="relative h-[5px] flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-border-default)' }}
          role="progressbar"
          aria-valuenow={idx + 1}
          aria-valuemin={1}
          aria-valuemax={queue.length}
          aria-label={t('progress', { current: idx + 1, total: queue.length })}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${String(progress)}%`,
              background: 'var(--ssz-color-primary-500)',
              transition: 'width 280ms cubic-bezier(0.16,1,0.3,1)',
            }}
            aria-hidden="true"
          />
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-(--ssz-text-muted)" aria-hidden="true">
          {t('progress', { current: idx + 1, total: queue.length })}
        </span>
      </div>

      {/* Quick-check badge */}
      {item.isCheck && (
        <div
          className="mb-4 flex items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ background: 'oklch(0.95 0.045 82)', borderColor: 'oklch(0.87 0.08 55)' }}
          aria-label={t('quickCheck')}
        >
          <Zap size={12} style={{ color: 'oklch(0.58 0.12 82)' }} aria-hidden="true" />
          <span className="text-[11.5px] font-bold" style={{ color: 'oklch(0.46 0.09 82)' }}>
            {t('quickCheck')}
          </span>
        </div>
      )}

      {/* Word card */}
      <div
        className="w-full rounded-[24px] border text-center"
        style={{
          background: 'var(--ssz-bg-surface)',
          borderColor: item.isCheck ? 'oklch(0.87 0.08 55 / 60%)' : 'var(--ssz-border-default)',
          boxShadow: item.isCheck
            ? 'var(--ssz-shadow-lg), 0 0 0 5px oklch(0.96 0.04 82)'
            : 'var(--ssz-shadow-lg)',
          padding: '48px 36px 40px',
          opacity: exiting ? 0 : 1,
          transform:
            exiting === 'know'
              ? 'translateX(-36px) rotate(-2.5deg)'
              : exiting === 'new'
              ? 'translateX(36px) rotate(2.5deg)'
              : 'none',
          transition: 'opacity 240ms ease, transform 240ms cubic-bezier(0.4,0,0.6,1)',
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="mb-4 flex justify-center">
          <VocabTagPill pos={item.pos} />
        </div>
        <p
          className="mb-3 font-reading text-[52px] font-semibold leading-none text-(--ssz-text-primary)"
          style={{ letterSpacing: '-0.025em' }}
          lang="nb"
        >
          {item.word}
        </p>
        {item.ipa && (
          <p className="mb-6 font-mono text-[14px] text-(--ssz-text-muted)">{item.ipa}</p>
        )}
        <div className="flex justify-center">
          <VocabAudioBtn src={item.audioUrl} />
        </div>
      </div>

      {/* Know / New buttons */}
      <div className="mt-5 flex w-full gap-3">
        {/* Know it */}
        <button
          type="button"
          onClick={() => advance(true)}
          className={cn(
            'flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-[17px] px-2.5',
            'cursor-pointer transition-[filter]',
            'hover:brightness-95 active:brightness-90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          )}
          style={{
            borderColor: 'oklch(0.76 0.11 145)',
            background: 'oklch(0.96 0.04 145)',
            transitionDuration: 'var(--ssz-duration-fast)',
            fontFamily: 'var(--ssz-font-ui)',
          }}
        >
          <CheckCircle size={26} style={{ color: 'oklch(0.50 0.12 145)' }} aria-hidden="true" />
          <span className="text-[14px] font-bold" style={{ color: 'oklch(0.44 0.11 145)' }}>
            {t('knowIt')}
          </span>
          <span className="text-[10.5px]" style={{ color: 'oklch(0.60 0.09 145)', opacity: 0.7 }}>
            {t('knowItHint')}
          </span>
        </button>

        {/* New to me */}
        <button
          type="button"
          onClick={() => advance(false)}
          className={cn(
            'flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 py-[17px] px-2.5',
            'cursor-pointer transition-[filter]',
            'hover:brightness-105 active:brightness-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          )}
          style={{
            borderColor: 'var(--ssz-color-primary-500)',
            background: 'var(--ssz-color-primary-500)',
            transitionDuration: 'var(--ssz-duration-fast)',
            fontFamily: 'var(--ssz-font-ui)',
          }}
        >
          <BookOpen size={26} style={{ color: '#fff' }} aria-hidden="true" />
          <span className="text-[14px] font-bold text-white">{t('newToMe')}</span>
          <span className="text-[10.5px] text-white/60">{t('newToMeHint')}</span>
        </button>
      </div>

      {/* Footnote */}
      <p className="mt-4 max-w-[310px] text-center text-[11.5px] leading-relaxed text-(--ssz-text-muted)">
        {t('knownNote')}
      </p>
    </div>
  );
}
