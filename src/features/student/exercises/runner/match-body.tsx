'use client';

import { CheckCircle, XCircle, Target } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { type RunnerMode, type RunnerPhase } from './types';

export interface MatchPair {
  /** Shared ID: `links[pair.id] === pair.id` means the pair is correctly connected. */
  id: string;
  /** Target-language text shown on the left (serif). */
  left: string;
  /** Native-language text shown on the right (sans). */
  right: string;
}

export interface MatchContent {
  pairs: MatchPair[];
  instruction?: string;
}

export interface MatchBodyProps {
  content: MatchContent;
  /** Parent-managed: leftPairId → rightPairId. */
  links: Record<string, string>;
  onLinksChange: (links: Record<string, string>) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — body never reveals correctness. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
}

/* ── hue palette for connected pairs (cycled by left-pair index) ── */
const PAIR_HUES = [
  'oklch(0.60 0.12 235)', // blue
  'oklch(0.62 0.13 300)', // violet
  'oklch(0.62 0.13 25)',  // orange
  'oklch(0.55 0.12 145)', // green
];

const OK_BG   = 'var(--ssz-color-success-50)';
const OK_LINE = 'var(--ssz-color-success-500)';
const OK_FG   = 'oklch(0.40 0.12 145)';
const NO_BG   = 'var(--ssz-color-error-50)';
const NO_LINE = 'var(--ssz-color-error-500)';
const NO_FG   = 'var(--ssz-color-error-700)';
const READING = 'var(--ssz-font-reading)';

/** oklch(L C H) → oklch(L C H / 0.08) for a very light fill. */
function hueFill(hue: string): string {
  return hue.replace(')', ' / 0.08)');
}

/** Fisher-Yates shuffle returning a new array of indices. */
function shuffleIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as number;
    arr[i] = arr[j] as number;
    arr[j] = tmp;
  }
  return arr;
}

interface CellStyle {
  bg: string;
  border: string;
  color: string;
}

function getCellStyle(
  armed: boolean,
  status: 'ok' | 'no' | null,
  hue: string | null,
  accent: string,
): CellStyle {
  if (status === 'ok') return { bg: OK_BG,  border: OK_LINE, color: OK_FG };
  if (status === 'no') return { bg: NO_BG,  border: NO_LINE, color: NO_FG };
  if (hue)             return { bg: hueFill(hue), border: hue, color: 'var(--ssz-text-primary)' };
  if (armed)           return { bg: hueFill(accent), border: accent, color: 'var(--ssz-text-primary)' };
  return { bg: 'var(--ssz-bg-surface)', border: 'var(--ssz-border-default)', color: 'var(--ssz-text-primary)' };
}

export function MatchBody({
  content,
  links,
  onLinksChange,
  onAnswerChange,
  phase,
  ok,
  accent,
}: MatchBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const { pairs } = content;
  const isAnswering = phase === 'answering';
  const reveal = phase === 'feedback';

  /* armed left cell (internal UI state) */
  const [armedId, setArmedId] = useState<string | null>(null);

  /* shuffled right-column — computed once at mount via lazy useState initializer */
  const [shuffledRights] = useState<MatchPair[]>(() =>
    shuffleIndices(pairs.length).map((i) => pairs[i] as MatchPair),
  );

  /* ── interaction handlers ─────────────────────────────────────── */

  function handleLeft(pairId: string) {
    if (!isAnswering) return;
    if (links[pairId] !== undefined) {
      // Already linked → unlink and re-arm
      const next = { ...links };
      delete next[pairId];
      onLinksChange(next);
      onAnswerChange(Object.keys(next).length === pairs.length);
      setArmedId(pairId);
    } else {
      // Toggle armed state
      setArmedId((prev) => (prev === pairId ? null : pairId));
    }
  }

  function handleRight(rightPairId: string) {
    if (!isAnswering || armedId === null) return;
    const next = { ...links };
    // Remove any existing link pointing to this right cell (move-link rule)
    Object.keys(next).forEach((k) => {
      if (next[k] === rightPairId) delete next[k];
    });
    next[armedId] = rightPairId;
    onLinksChange(next);
    onAnswerChange(Object.keys(next).length === pairs.length);
    setArmedId(null);
  }

  const instruction = content.instruction ?? t('match.defaultInstruction');

  return (
    <>
      <Instr>{instruction}</Instr>

      <div
        className="mt-1 grid gap-3"
        style={{ gridTemplateColumns: '1fr 1fr' }}
      >
        {/* Left column — target language (serif) */}
        <div className="flex flex-col gap-2.5">
          {pairs.map((pair, li) => {
            const isArmed   = armedId === pair.id;
            const isLinked  = links[pair.id] !== undefined;
            const hue       = isLinked ? (PAIR_HUES[li % PAIR_HUES.length] ?? null) : null;
            const leftStatus: 'ok' | 'no' | null =
              reveal && ok !== null
                ? links[pair.id] === pair.id ? 'ok'
                : isLinked ? 'no'
                : null
                : null;
            const c = getCellStyle(isArmed, leftStatus, hue, accent);
            const badgeNum = isLinked ? li + 1 : null;

            return (
              <button
                key={pair.id}
                disabled={!isAnswering}
                onClick={() => handleLeft(pair.id)}
                aria-pressed={isArmed}
                style={{
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: 12,
                  cursor: isAnswering ? 'pointer' : 'default',
                  border: `2px solid ${c.border}`,
                  background: c.bg,
                  color: c.color,
                  fontFamily: READING,
                  fontSize: 16,
                  fontWeight: 600,
                  transition: 'all 130ms var(--ssz-ease-out)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  outline: isArmed ? `2px solid ${accent}` : 'none',
                  outlineOffset: 2,
                }}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
              >
                {badgeNum !== null && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: hue ?? accent,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--ssz-font-ui)',
                      flexShrink: 0,
                    }}
                  >
                    {badgeNum}
                  </span>
                )}
                <span className="flex-1">{pair.left}</span>
                {reveal && leftStatus === 'ok' && (
                  <CheckCircle size={16} style={{ color: OK_LINE, flexShrink: 0 }} aria-hidden="true" />
                )}
                {reveal && leftStatus === 'no' && (
                  <XCircle size={16} style={{ color: NO_LINE, flexShrink: 0 }} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right column — native language (sans) */}
        <div className="flex flex-col gap-2.5">
          {shuffledRights.map((pair) => {
            const linkedLeftId = Object.keys(links).find((k) => links[k] === pair.id);
            const isLinked     = linkedLeftId !== undefined;
            const leftIndex    = isLinked
              ? pairs.findIndex((p) => p.id === linkedLeftId)
              : -1;
            const hue          = isLinked && leftIndex >= 0
              ? (PAIR_HUES[leftIndex % PAIR_HUES.length] ?? null)
              : null;
            const c = getCellStyle(false, null, hue, accent);
            const badgeNum = isLinked && leftIndex >= 0 ? leftIndex + 1 : null;
            // Dimmed when answering + no armed left cell + not yet linked
            const dimmed = isAnswering && armedId === null && !isLinked;

            return (
              <button
                key={pair.id}
                disabled={!isAnswering || armedId === null}
                onClick={() => handleRight(pair.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: 12,
                  cursor: isAnswering && armedId !== null ? 'pointer' : 'default',
                  border: `2px solid ${c.border}`,
                  background: c.bg,
                  color: c.color,
                  fontFamily: 'inherit',
                  fontSize: 15,
                  fontWeight: 500,
                  transition: 'all 130ms var(--ssz-ease-out)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  opacity: dimmed ? 0.65 : 1,
                }}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
              >
                {badgeNum !== null && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: hue ?? accent,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {badgeNum}
                  </span>
                )}
                <span className="flex-1">{pair.right}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Helper text — answering phase only */}
      {isAnswering && (
        <div
          className="mt-4 flex items-center gap-1.75 text-[12.5px]"
          style={{ color: 'var(--ssz-text-muted)' }}
          aria-live="polite"
        >
          <Target size={13} style={{ color: 'var(--ssz-text-muted)', flexShrink: 0 }} aria-hidden="true" />
          {armedId !== null ? t('match.helperArmed') : t('match.helperIdle')}
        </div>
      )}
    </>
  );
}
