'use client';

import { Check, Ear, Info, Pause, Play, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import type { MinimalPairsSubmitDetails } from '@/features/student/exercises/types/attempts';

import type { Clips } from './minimal-pairs-clips';

const READING = 'var(--ssz-font-reading)';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface MinimalPairsSummaryProps {
  summary: MinimalPairsSubmitDetails;
  /** «kj / sj» — the contrast the closing line names. */
  contrastLabel: string;
  clips: Clips;
  interactive?: boolean;
  onRestart?: () => void;
  /** The sittings the author allows, once «Ny runde» was refused for them (Q4-A). */
  sittingsSpent?: number | null;
  restarting?: boolean;
  accent: string;
}

/**
 * The end of a sitting — the prototype's `MPSummary` (plan 72 §7.9).
 *
 * Every number is the server's: the tally of first answers, the verdict against the author's
 * pass mark — which reaches the student only here (§5, row 13) — and one line per pair that came
 * up, with the pair's own clips for «Hør paret». The closing line is worded by what the result
 * moves (§4.2, point 6): «the words come back» only when the words are rated, «not in this
 * exercise» when nothing is.
 */
export function MinimalPairsSummary({
  summary,
  contrastLabel,
  clips,
  interactive = true,
  onRestart,
  sittingsSpent = null,
  restarting = false,
  accent,
}: MinimalPairsSummaryProps) {
  const t = useTranslations('ExerciseRunner.minimalPairs.summary');
  const pass = summary.passed;
  const weak = summary.pairs.some((p) => p.correct < p.played);
  const memory = summary.memory ?? 'contrast';
  const bold = (chunk: ReactNode) => <b>{chunk}</b>;

  return (
    <div className="flex w-full flex-col gap-3.5" data-testid="mp-summary">
      {/* mp-score */}
      <div
        data-v={pass ? 'pass' : 'again'}
        className="flex flex-col items-center gap-1.5 rounded-(--ssz-radius-lg) border px-4 py-[22px]"
        style={{
          background: pass ? 'var(--ssz-color-success-50)' : 'var(--ssz-color-warning-50)',
          borderColor: pass ? 'var(--ssz-color-success-300)' : 'var(--ssz-color-warning-300)',
        }}
      >
        <span className="text-[40px] font-bold leading-none text-(--ssz-text-primary)">
          {summary.right}
          <i className="text-xl not-italic text-(--ssz-text-muted)">/{summary.total}</i>
        </span>
        <span
          className="inline-flex items-center gap-[5px] rounded-full px-2.5 py-[3px] text-xs font-semibold text-white"
          style={{
            background: pass ? 'var(--ssz-color-success-500)' : 'var(--ssz-color-warning-500)',
          }}
        >
          {pass ? (
            <Check size={13} aria-hidden="true" />
          ) : (
            <RotateCcw size={13} aria-hidden="true" />
          )}
          {pass ? t('passed') : t('again')}
        </span>
        <p className="m-0 text-xs text-(--ssz-text-muted)">
          {t('score', { pct: summary.score, pass: summary.passPct })}
        </p>
      </div>

      {/* mp-sumlist */}
      <div className="flex flex-col gap-1.5">
        {summary.pairs.map((p) => {
          const ratio = p.played === 0 ? 0 : p.correct / p.played;
          const playable = p.clips.some((url) => url !== '');
          const on = clips.now !== null && clips.now.startsWith(`${p.pairId}:`);
          return (
            <div
              key={p.pairId}
              data-low={p.correct < p.played ? 'true' : undefined}
              className="grid items-center gap-2.5 text-sm"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 90px 44px 30px', fontFamily: READING }}
            >
              <span className="truncate">{p.words.join(' / ')}</span>
              <span
                className="block h-[7px] overflow-hidden rounded-full"
                style={{ background: 'var(--ssz-bg-muted)' }}
                aria-hidden="true"
              >
                <i
                  className="block h-full"
                  style={{
                    width: `${ratio * 100}%`,
                    background:
                      ratio < 0.6 ? 'var(--ssz-color-warning-500)' : 'var(--ssz-color-success-500)',
                  }}
                />
              </span>
              <b
                className="text-[11px] text-(--ssz-text-muted)"
                style={{ fontFamily: 'var(--ssz-font-mono)' }}
              >
                {p.correct}/{p.played}
              </b>
              <button
                type="button"
                aria-label={t('hearPair')}
                title={t('hearPair')}
                aria-pressed={on}
                disabled={!interactive || !playable}
                onClick={() => {
                  if (on) {
                    clips.stop();
                    return;
                  }
                  // A clip that could not be signed is skipped rather than shifting the others
                  // onto the wrong word: the ids keep each one's place in the pair.
                  void clips.sequence(p.clips.map((url, i) => ({ id: `${p.pairId}:${i}`, url })));
                }}
                className={`grid size-[30px] place-items-center rounded-(--ssz-radius-sm) text-(--ssz-text-secondary) enabled:hover:bg-(--ssz-bg-subtle) disabled:opacity-40 ${FOCUS}`}
              >
                {on ? (
                  <Pause size={14} aria-hidden="true" />
                ) : (
                  <Play size={14} aria-hidden="true" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {weak ? (
        <div
          data-tone="tip"
          className="flex gap-2.5 rounded-(--ssz-radius-sm) border px-[13px] py-[11px] text-sm leading-snug"
          style={{
            background: 'var(--ssz-color-primary-50)',
            borderColor: 'var(--ssz-color-primary-100)',
            color: 'var(--ssz-color-primary-700)',
          }}
        >
          <Ear size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p className="m-0 min-w-0 flex-1">
            {memory === 'contrast+word' && <>{t('wordsReturn')} </>}
            {memory === 'none'
              ? t.rich('contrastNotHere', { label: contrastLabel, b: bold })
              : t.rich('contrastScheduled', { label: contrastLabel, b: bold })}
          </p>
        </div>
      ) : (
        <div
          data-tone="info"
          className="flex gap-2.5 rounded-(--ssz-radius-sm) border px-[13px] py-[11px] text-sm leading-snug"
          style={{
            background: 'var(--ssz-color-info-50)',
            borderColor: 'var(--ssz-color-info-100)',
            color: 'var(--ssz-color-info-700)',
          }}
        >
          <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p className="m-0 min-w-0 flex-1">{t('allRight')}</p>
        </div>
      )}

      {onRestart !== undefined && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onRestart}
            disabled={!interactive || restarting || sittingsSpent !== null}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-(--ssz-radius-sm) px-4 py-3 text-sm font-semibold text-white disabled:opacity-45 ${FOCUS}`}
            style={{ background: accent, minHeight: 44 }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t('newRound')}
          </button>
          {sittingsSpent !== null && (
            <p role="status" className="m-0 text-center text-xs text-(--ssz-text-muted)">
              {t('sittingsSpent', { n: sittingsSpent })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
