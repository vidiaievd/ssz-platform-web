'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BottomBar } from '@/features/learning';
import { cn } from '@/lib/utils';

import { AnnotatedParagraph } from './annotated-paragraph';
import { ListenModeToggle } from './listen-mode-toggle';
import { ReadAudioPlayer } from './read-audio-player';
import type { GlossaryMap, ListenMode, TextParagraph } from './read-section-types';

const PARA_TIMES: number[] = []; // populated from backend once available

export interface ReadSectionProps {
  unitNumber: number;
  courseTitle: string;
  /** Norwegian title of the reading text. */
  lessonTitle: string;
  /** English subtitle. */
  lessonSubtitle?: string;
  paragraphs: TextParagraph[];
  glossary: GlossaryMap;
  audioUrl?: string;
  illustrationUrl?: string;
  /** Second-level timestamps for each paragraph (for listen-text highlighting). */
  paraTimestamps?: number[];
  onContinue: () => void;
}

export function ReadSection({
  unitNumber,
  courseTitle,
  lessonTitle,
  lessonSubtitle,
  paragraphs,
  glossary,
  audioUrl,
  illustrationUrl,
  paraTimestamps = PARA_TIMES,
  onContinue,
}: ReadSectionProps) {
  const t = useTranslations('Learning.readSection');

  const [mode,     setMode]     = useState<ListenMode>('read');
  const [showTr,   setShowTr]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [finished, setFinished] = useState(false);

  const hasAudio = !!audioUrl;

  /* Derive the active paragraph index from currentTime + timestamps */
  const activePara = useMemo(() => {
    if (mode !== 'listen-text' || paraTimestamps.length === 0) return -1;
    return paraTimestamps.reduce(
      (acc, ts, i) => (currentTime >= ts ? i : acc),
      0,
    );
  }, [currentTime, mode, paraTimestamps]);

  function handleModeChange(next: ListenMode) {
    setMode(next);
  }

  const handleParaClick = useCallback(
    (idx: number) => {
      if (paraTimestamps[idx] !== undefined) setCurrentTime(paraTimestamps[idx]!);
    },
    [paraTimestamps],
  );

  const listenOnly = mode === 'listen-only';
  const progressPct = 0; // driven by ReadAudioPlayer state; kept here for listen-only bar

  /* CTA label */
  let ctaLabel: React.ReactNode;
  if (finished) {
    ctaLabel = (
      <>
        <Check size={16} aria-hidden="true" />
        {t('finishedNext')}
      </>
    );
  } else if (mode === 'read') {
    ctaLabel = t('finishedReading');
  } else {
    ctaLabel = t('finishedListening');
  }

  return (
    <div
      className="flex w-full flex-col"
      style={{ maxWidth: 640, padding: '28px 24px 120px' }}
    >
      {/* Illustration */}
      <div
        className="mb-7 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px]"
        style={{
          height: illustrationUrl ? undefined : 180,
          background: illustrationUrl ? undefined : 'var(--ssz-bg-subtle)',
          border: illustrationUrl ? undefined : '1.5px dashed var(--ssz-border-strong)',
          position: 'relative',
        }}
        aria-hidden={!illustrationUrl}
      >
        {illustrationUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={illustrationUrl}
            alt=""
            className="h-[180px] w-full rounded-[20px] object-cover"
          />
        ) : (
          <>
            {/* Diagonal stripe pattern */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}
              aria-hidden="true"
            >
              <defs>
                <pattern id="rl-stripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="12" stroke="var(--ssz-border-strong)" strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#rl-stripe)" />
            </svg>
            <Eye size={28} style={{ color: 'var(--ssz-border-strong)', position: 'relative' }} aria-hidden="true" />
            <span
              className="relative text-[11px] text-(--ssz-text-muted)"
              style={{ fontFamily: 'var(--ssz-font-mono)' }}
            >
              {t('illustrationPlaceholder')}
            </span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="mb-5">
        <p
          className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--ssz-color-primary-700)' }}
        >
          {t('unitCourse', { unit: unitNumber, course: courseTitle })}
        </p>
        <h1
          className="m-0 font-reading text-[30px] font-semibold leading-tight text-(--ssz-text-primary)"
          style={{ letterSpacing: '-0.015em' }}
          lang="nb"
        >
          {lessonTitle}
        </h1>
        {lessonSubtitle && (
          <p className="mt-1 text-[13.5px] italic text-(--ssz-text-muted)">{lessonSubtitle}</p>
        )}
      </div>

      {/* Mode toggle row */}
      <div className="mb-7 flex flex-wrap items-center gap-3.5">
        <ListenModeToggle mode={mode} hasAudio={hasAudio} onChange={handleModeChange} />
        {Object.keys(glossary).length > 0 && (
          <span className="flex items-center gap-1.5 text-[12px] text-(--ssz-text-muted)">
            <span
              className="inline-block w-7 align-middle"
              style={{ borderBottom: '1.5px dotted oklch(0.62 0.105 168 / 70%)' }}
              aria-hidden="true"
            />
            {t('tapToLookUp')}
          </span>
        )}
      </div>

      {/* Listen-only hero */}
      {listenOnly && (
        <div
          className="flex flex-col items-center gap-4 pb-5 pt-8"
          style={{ animation: 'rl-fadeup 220ms ease both' }}
        >
          <style>{`
            @keyframes rl-fadeup { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
            @keyframes rl-pulse  { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.12);opacity:.2} }
          `}</style>

          <div className="relative">
            <div
              className="absolute inset-[-8px] rounded-full border-2"
              style={{
                borderColor: 'oklch(0.62 0.105 168 / 30%)',
                animation: 'rl-pulse 1.4s ease-in-out infinite',
              }}
              aria-hidden="true"
            />
            <div
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2"
              style={{
                background: 'oklch(0.62 0.105 168 / 14%)',
                borderColor: 'oklch(0.62 0.105 168 / 30%)',
              }}
            >
              <Headphones size={32} style={{ color: 'var(--ssz-color-primary-500)' }} aria-hidden="true" />
            </div>
          </div>

          <div className="text-center">
            <p className="font-reading text-[22px] font-semibold text-(--ssz-text-primary)" lang="nb">
              {lessonTitle}
            </p>
            <p className="mt-1 text-[13px] italic text-(--ssz-text-muted)">
              {t('pressPlayToListen')}
            </p>
          </div>

          {/* Thin progress bar */}
          <div
            className="w-full max-w-[320px] rounded-full"
            style={{ height: 3, background: 'var(--ssz-bg-muted)' }}
            aria-hidden="true"
          >
            <div
              className="rounded-full"
              style={{
                height: '100%',
                width: `${String(progressPct)}%`,
                background: 'var(--ssz-color-primary-500)',
                transition: 'width 120ms linear',
              }}
            />
          </div>

          {/* Show text link */}
          <button
            type="button"
            onClick={() => setMode('listen-text')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
              'text-[12.5px] font-semibold text-(--ssz-color-primary-600)',
              'transition-colors hover:bg-(--ssz-color-primary-500)/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            <Eye size={14} aria-hidden="true" />
            {t('showText')}
          </button>
        </div>
      )}

      {/* Paragraphs */}
      {!listenOnly && (
        <div className="flex flex-col gap-6">
          {mode === 'listen-text' && (
            <p className="mb-[-8px] flex items-center gap-1.5 text-[12px] text-(--ssz-text-muted)">
              <Headphones size={12} aria-hidden="true" />
              {t('tapParagraphToJump')}
            </p>
          )}
          {paragraphs.map((para, i) => (
            <AnnotatedParagraph
              key={i}
              target={para.target}
              translation={para.translation}
              glossary={glossary}
              isActive={activePara === i}
              listenMode={mode}
              showTranslation={showTr}
              onParaClick={() => handleParaClick(i)}
            />
          ))}
        </div>
      )}

      {/* Translation toggle (read mode only) */}
      {mode === 'read' && (
        <button
          type="button"
          onClick={() => setShowTr((v) => !v)}
          className={cn(
            'mt-5 self-start inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5',
            'text-[12.5px] font-semibold transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            showTr
              ? 'border-(--ssz-color-primary-500) text-(--ssz-color-primary-600)'
              : 'border-(--ssz-border-default) text-(--ssz-text-secondary) hover:border-(--ssz-color-primary-500) hover:text-(--ssz-color-primary-600)',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {showTr ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
          {showTr ? t('hideTranslation') : t('showTranslation')}
        </button>
      )}

      {/* Audio player */}
      <div className="mt-7">
        <ReadAudioPlayer
          src={audioUrl}
          trackTitle={lessonTitle}
          trackSubtitle={courseTitle}
          compact={mode === 'read'}
          onTimeUpdate={setCurrentTime}
          onProgress={(done) => { if (done) setFinished(true); }}
        />
      </div>

      {/* Bottom CTA */}
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
          {ctaLabel}
        </button>
      </BottomBar>
    </div>
  );
}
