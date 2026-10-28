'use client';

import { Fragment, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { passagePieces, wordKey } from '@/lib/shared-kernel/read-aloud';

import type { AiPronunciation, AiReadingOp, AiReadingPrompt } from '../types';

const READING = 'var(--ssz-font-reading)';

/** Below this a pronounced word is named as unclear, whatever error Azure gave it. */
const UNCLEAR_BELOW = 60;

type T = ReturnType<typeof useTranslations<'Review.aiReview.reading'>>;

export interface ReadingCheckProps {
  prompt: AiReadingPrompt;
  /** The share of the prompt's words it had to read, as ruled. */
  passPercent: number;
  /**
   * The passage as the screen has it today. Drawn with its own case and punctuation when it
   * still matches what was ruled; otherwise — edited since, or not at hand — the words are
   * drawn from the check itself.
   */
  passage?: string | null;
}

/**
 * The machine's check of one prompt read aloud (plan 82, step 11): the passage with the words
 * missed or read as others marked, the count against the pass mark, what was heard, the pace
 * where the author asks for it, and — where the plan includes it — pronunciation feedback;
 * neither of the last two changed the result.
 *
 * Draws only what the engine ruled; nothing is checked again here.
 */
export function ReadingCheck({ prompt, passPercent, passage = null }: ReadingCheckProps) {
  const t = useTranslations('Review.aiReview.reading');
  const kinds = new Set(prompt.ops.map((op) => op.k));

  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11.5px] font-semibold"
          style={
            prompt.passed
              ? { background: 'var(--ssz-color-success-50)', color: 'var(--ssz-color-success-700)' }
              : { background: 'var(--ssz-color-warning-50)', color: 'var(--ssz-color-warning-700)' }
          }
        >
          {prompt.passed ? (
            <Check size={12} aria-hidden="true" />
          ) : (
            <X size={12} aria-hidden="true" />
          )}
          {prompt.passed ? t('passed') : t('notPassed')}
        </span>
        <span className="tabular-nums">
          {t('count', { read: prompt.read, total: prompt.total, percent: prompt.percent })}
        </span>
        <span className="tabular-nums text-(--ssz-text-muted)">
          {t('mark', { percent: passPercent })}
        </span>
      </p>

      <p className="m-0 text-[15px] leading-loose" style={{ fontFamily: READING }}>
        <Passage t={t} ops={prompt.ops} total={prompt.total} passage={passage} />
      </p>

      {(kinds.has('missed') || kinds.has('misread') || kinds.has('extra')) && (
        <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-(--ssz-text-muted)">
          {kinds.has('missed') && (
            <span>
              <Missed>{t('legend.word')}</Missed> {t('legend.missed')}
            </span>
          )}
          {kinds.has('misread') && (
            <span>
              <Misread expected={t('legend.word')} heard={t('legend.heard')} />{' '}
              {t('legend.misread')}
            </span>
          )}
          {kinds.has('extra') && (
            <span>
              <Extra>{t('legend.heard')}</Extra> {t('legend.extra')}
            </span>
          )}
        </p>
      )}

      <p className="m-0 text-[12.5px] text-(--ssz-text-secondary)">
        <b className="font-semibold">{t('heard')}</b>{' '}
        {prompt.transcript.trim() === '' ? (
          t('nothingHeard')
        ) : (
          <span style={{ fontFamily: READING }}>{prompt.transcript}</span>
        )}
      </p>

      {prompt.wordsPerMinute !== null && (
        <p className="m-0 text-[12.5px] tabular-nums text-(--ssz-text-secondary)">
          {t('pace', { wpm: Math.round(prompt.wordsPerMinute) })}
        </p>
      )}

      {prompt.pronunciation !== null && <Pronunciation t={t} scores={prompt.pronunciation} />}
    </div>
  );
}

/**
 * The passage with the check laid over it. Each passage word is found by its index in the
 * ops; words heard that are not in the passage sit after the word they were heard behind.
 */
function Passage({
  t,
  ops,
  total,
  passage,
}: {
  t: T;
  ops: readonly AiReadingOp[];
  total: number;
  passage: string | null;
}) {
  const pieces = passage === null ? null : passagePieces(passage);
  const words = pieces?.filter((piece) => piece.word !== undefined) ?? [];

  if (
    pieces === null ||
    !matches(
      words.map((w) => w.word!),
      ops,
      total,
    )
  ) {
    return <OpsOnly t={t} ops={ops} />;
  }

  // What happened to each passage word, and what was heard after it.
  const status = new Map<number, AiReadingOp>();
  const after = new Map<number, string[]>();
  const before: string[] = [];
  let last = -1;
  for (const op of ops) {
    if (op.k === 'extra') {
      if (last < 0) before.push(op.heard);
      else after.set(last, [...(after.get(last) ?? []), op.heard]);
      continue;
    }
    status.set(op.i, op);
    last = op.k === 'read' ? op.i + op.n - 1 : op.i;
  }

  // The passage word index of each piece; -1 for what stands between words.
  const indices: number[] = [];
  let next = 0;
  for (const piece of pieces) indices.push(piece.word === undefined ? -1 : next++);

  return (
    <>
      {before.map((heard, i) => (
        <Fragment key={`b${i}`}>
          <Extra sr={t('sr.extra')}>{heard}</Extra>{' '}
        </Fragment>
      ))}
      {pieces.map((piece, at) => {
        const index = indices[at]!;
        if (index < 0) return <span key={at}>{piece.text}</span>;
        const op = status.get(index);
        const extras = after.get(index) ?? [];
        return (
          <Fragment key={at}>
            {op?.k === 'missed' ? (
              <Missed sr={t('sr.missed')}>{piece.text}</Missed>
            ) : op?.k === 'misread' ? (
              <Misread
                expected={piece.text}
                heard={op.heard}
                sr={t('sr.misread', { heard: op.heard })}
              />
            ) : (
              <span
                className={
                  op !== undefined && 'focus' in op && op.focus ? 'font-semibold' : undefined
                }
              >
                {piece.text}
              </span>
            )}
            {extras.map((heard, i) => (
              <Fragment key={i}>
                {' '}
                <Extra sr={t('sr.extra')}>{heard}</Extra>
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

/** The passage words of today's text are the words the check was made over. */
function matches(words: readonly string[], ops: readonly AiReadingOp[], total: number): boolean {
  if (words.length !== total) return false;
  return ops.every(
    (op) =>
      op.k === 'extra' ||
      op.k === 'read' ||
      (words[op.i] !== undefined && wordKey(words[op.i]!) === wordKey(op.expected)),
  );
}

/** Without the passage: the words as the check holds them, in its order. */
function OpsOnly({ t, ops }: { t: T; ops: readonly AiReadingOp[] }) {
  return (
    <>
      {ops.map((op, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          {op.k === 'read' ? (
            <span className={op.focus ? 'font-semibold' : undefined}>{op.heard}</span>
          ) : op.k === 'missed' ? (
            <Missed sr={t('sr.missed')}>{op.expected}</Missed>
          ) : op.k === 'misread' ? (
            <Misread
              expected={op.expected}
              heard={op.heard}
              sr={t('sr.misread', { heard: op.heard })}
            />
          ) : (
            <Extra sr={t('sr.extra')}>{op.heard}</Extra>
          )}
        </Fragment>
      ))}
    </>
  );
}

function Missed({ children, sr }: { children: ReactNode; sr?: string }) {
  return (
    <span
      className="rounded-[4px] px-[3px] line-through decoration-2"
      style={{
        background: 'var(--ssz-color-warning-50)',
        color: 'var(--ssz-color-warning-700)',
        textDecorationColor: 'var(--ssz-color-warning-500)',
      }}
    >
      {children}
      {sr !== undefined && <span className="sr-only"> ({sr})</span>}
    </span>
  );
}

function Misread({ expected, heard, sr }: { expected: string; heard: string; sr?: string }) {
  return (
    <span>
      <span
        className="underline decoration-wavy decoration-2 underline-offset-4"
        style={{ textDecorationColor: 'var(--ssz-color-warning-500)' }}
      >
        {expected}
      </span>
      <span
        aria-hidden={sr !== undefined}
        className="ml-1 align-super text-[11px]"
        style={{ color: 'var(--ssz-color-warning-700)', fontFamily: 'inherit' }}
      >
        {heard}
      </span>
      {sr !== undefined && <span className="sr-only"> ({sr})</span>}
    </span>
  );
}

function Extra({ children, sr }: { children: ReactNode; sr?: string }) {
  return (
    <span className="text-[12px] italic text-(--ssz-text-muted)">
      +{children}
      {sr !== undefined && <span className="sr-only"> ({sr})</span>}
    </span>
  );
}

/** Azure's scores and the words it found unclear — a hint, said to be one. */
function Pronunciation({ t, scores }: { t: T; scores: AiPronunciation }) {
  const unclear = scores.words.filter(
    (w) => w.error === 'mispronunciation' || (w.error === 'none' && w.accuracy < UNCLEAR_BELOW),
  );
  return (
    <div className="flex flex-col gap-0.5 rounded-[9px] bg-(--ssz-bg-surface-subtle) px-3 py-2 text-[12.5px]">
      <p className="m-0">
        <b className="font-semibold">{t('pronunciation.title')}</b>{' '}
        <span className="tabular-nums">
          {t('pronunciation.scores', {
            accuracy: Math.round(scores.accuracy),
            fluency: Math.round(scores.fluency),
            completeness: Math.round(scores.completeness),
          })}
          {scores.prosody !== null &&
            ` · ${t('pronunciation.prosody', { prosody: Math.round(scores.prosody) })}`}
        </span>
      </p>
      {unclear.length > 0 && (
        <p className="m-0">
          {t('pronunciation.unclear')}{' '}
          <span style={{ fontFamily: READING }}>{unclear.map((w) => w.text).join(', ')}</span>
        </p>
      )}
      <p className="m-0 text-[11.5px] text-(--ssz-text-muted)">{t('pronunciation.note')}</p>
    </div>
  );
}
