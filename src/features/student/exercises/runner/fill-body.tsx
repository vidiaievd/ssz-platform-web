'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

/**
 * Content schema for fill-in-the-blank exercises.
 * `textWithBlanks` uses `___1___` markers for blank positions (one blank supported here).
 * `gloss` is an optional italic translation shown above the sentence.
 * `wordBank` when present activates chip-selection mode; absent = free-type input.
 */
export interface FillContent {
  textWithBlanks: string;
  gloss?: string;
  wordBank?: string[];
  instruction?: string;
}

export interface FillExpectedAnswers {
  /** Map of blank index ("1") → correct answer string. */
  answers: Record<string, string>;
  explanation?: string;
}

/** Verdict for one analysed option in the rationale matrix. */
export type RationaleVerdict = 'correct' | 'acceptable' | 'wrong';

export interface RationaleOption {
  text: string;
  verdict: RationaleVerdict;
  note?: string;
}

/**
 * Optional teaching aid shown as feedback AFTER checking: why the correct
 * choice fits and why typical wrong choices don't. Purely presentational —
 * it never takes part in grading.
 */
export interface FillRationale {
  explanation?: string;
  options?: RationaleOption[];
}

export interface FillBodyProps {
  content: FillContent;
  /** Current value for the (first) blank. */
  value: string;
  onValueChange: (val: string) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  /**
   * Optional per-blank explanation matrix, rendered only in the feedback phase.
   * Omitted for exercises authored without one — the body behaves exactly as before.
   */
  rationale?: FillRationale;
}

/* ── color constants ─────────────────────────────────────────────── */
const OK_BG   = 'var(--ssz-feedback-ok-bg)';
const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_FG   = 'var(--ssz-feedback-ok-fg)';
const NO_BG   = 'var(--ssz-feedback-no-bg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_FG   = 'var(--ssz-feedback-no-fg)';
const READING = "var(--ssz-font-reading)";

/** Split `textWithBlanks` around the first `___N___` marker. */
function parseBlanks(text: string): { before: string; after: string } {
  const match = /^([\s\S]*?)___\d+___([\s\S]*)$/.exec(text);
  if (!match) return { before: text, after: '' };
  return { before: match[1] ?? '', after: match[2] ?? '' };
}

interface ChipStyle {
  bg: string;
  border: string;
  color: string;
}

function getChipStyle(
  word: string,
  value: string,
  reveal: boolean,
  ok: boolean | null,
  accent: string,
  accentSoft: string,
): ChipStyle {
  const isSel = value === word;
  if (isSel && reveal && ok === true)
    return { bg: OK_BG, border: OK_LINE, color: OK_FG };
  if (isSel && reveal && ok === false)
    return { bg: NO_BG, border: NO_LINE, color: NO_FG };
  if (isSel)
    return { bg: accentSoft, border: accent, color: accent };
  return { bg: 'var(--ssz-bg-surface)', border: 'var(--ssz-border-default)', color: 'var(--ssz-text-primary)' };
}

/**
 * Per-verdict colors for the rationale matrix rows. `note` is the color of the
 * explanatory column: on a tinted row the muted secondary tone loses too much
 * contrast, so those rows fall back to the primary text color.
 */
function verdictStyle(verdict: RationaleVerdict): {
  mark: string;
  color: string;
  bg: string;
  note: string;
} {
  if (verdict === 'correct')
    return { mark: '✔', color: OK_FG, bg: OK_BG, note: 'var(--ssz-text-primary)' };
  if (verdict === 'acceptable')
    return {
      mark: '△',
      color: 'var(--ssz-text-secondary)',
      bg: 'var(--ssz-bg-surface)',
      note: 'var(--ssz-text-secondary)',
    };
  return { mark: '✗', color: NO_FG, bg: NO_BG, note: 'var(--ssz-text-primary)' };
}

/**
 * Post-check teaching aid: a compact table of the candidate answers with a
 * verdict and a short note for each. Rendered under the sentence in the
 * feedback phase so the student learns the rule, not just the answer.
 */
function RationaleMatrix({ rationale }: { rationale: FillRationale }) {
  const t = useTranslations('ExerciseRunner');
  const options = rationale.options ?? [];
  if (options.length === 0 && !rationale.explanation) return null;

  const verdictLabel: Record<RationaleVerdict, string> = {
    correct: t('fill.verdictCorrect'),
    acceptable: t('fill.verdictAcceptable'),
    wrong: t('fill.verdictWrong'),
  };

  return (
    <section
      className="mt-7 rounded-xl border p-4"
      style={{
        borderColor: 'var(--ssz-border-default)',
        background: 'var(--ssz-bg-subtle)',
      }}
      aria-label={t('fill.rationaleTitle')}
    >
      <h3
        className="mb-3 text-[13px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ssz-text-secondary)', fontFamily: 'var(--ssz-font-ui)' }}
      >
        {t('fill.rationaleTitle')}
      </h3>

      {rationale.explanation && (
        <p
          className="mb-3 text-[15px] leading-relaxed"
          style={{ color: 'var(--ssz-text-primary)', fontFamily: READING }}
        >
          {rationale.explanation}
        </p>
      )}

      {options.length > 0 && (
        <div className="overflow-x-auto">
          {/* border-separate + row spacing: each verdict row reads as its own
              rounded, padded chip rather than a full-bleed table band. */}
          <table
            className="w-full border-separate text-left text-[14px]"
            style={{ borderSpacing: '0 6px' }}
          >
            <thead>
              <tr style={{ color: 'var(--ssz-text-muted)' }}>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('fill.optionHeader')}
                </th>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('fill.verdictHeader')}
                </th>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('fill.noteHeader')}
                </th>
              </tr>
            </thead>
            <tbody>
              {options.map((opt) => {
                const s = verdictStyle(opt.verdict);
                return (
                  <tr key={opt.text}>
                    <td
                      className="px-3 py-2.5 align-top font-semibold"
                      style={{
                        fontFamily: READING,
                        color: s.color,
                        background: s.bg,
                        borderRadius: '10px 0 0 10px',
                      }}
                    >
                      {opt.text}
                    </td>
                    <td
                      className="px-3 py-2.5 align-top whitespace-nowrap"
                      style={{ color: s.color, background: s.bg }}
                    >
                      <span aria-hidden="true">{s.mark}</span>{' '}
                      <span className="text-[13px]">{verdictLabel[opt.verdict]}</span>
                    </td>
                    <td
                      className="px-3 py-2.5 align-top"
                      style={{
                        color: s.note,
                        background: s.bg,
                        borderRadius: '0 10px 10px 0',
                      }}
                    >
                      {opt.note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FillBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
  rationale,
}: FillBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const accentSoft = modeAccentSoft(mode);
  const reveal = phase === 'feedback';
  const isAnswering = phase === 'answering';
  const hasWordBank = Array.isArray(content.wordBank) && content.wordBank.length > 0;
  const { before, after } = parseBlanks(content.textWithBlanks);
  const inputRef = useRef<HTMLInputElement>(null);

  /* blank underline / text color */
  const blankColor =
    reveal && ok === false
      ? NO_LINE
      : reveal && ok === true
      ? OK_LINE
      : value
      ? accent
      : 'var(--ssz-text-muted)';

  /* notify runner */
  useEffect(() => {
    onAnswerChange(value.trim() !== '');
  }, [value, onAnswerChange]);

  /* 1–4 keyboard shortcuts for word bank (BEHAVIOR.md §6) */
  useEffect(() => {
    if (!isAnswering || !hasWordBank) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = ((e.target as HTMLElement).tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const word = content.wordBank?.[n - 1];
        if (word !== undefined) onValueChange(value === word ? '' : word);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnswering, hasWordBank, content.wordBank, value, onValueChange]);

  const instruction = content.instruction ?? t('fill.defaultInstruction');

  return (
    <>
      <Instr>{instruction}</Instr>

      {/* Gloss / translation hint */}
      {content.gloss && (
        <div
          className="mb-4 text-[13.5px] italic"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          {content.gloss}
        </div>
      )}

      {/* Sentence with inline blank */}
      <div
        className="mb-[26px] flex flex-wrap items-baseline gap-2 leading-[1.7]"
        style={{
          fontFamily: READING,
          fontSize: 22,
          fontWeight: 500,
          color: 'var(--ssz-text-primary)',
        }}
      >
        <span>{before}</span>

        {hasWordBank ? (
          /* Word-bank mode: underlined slot showing chosen word */
          <span
            style={{
              display: 'inline-block',
              minWidth: 96,
              textAlign: 'center',
              padding: '0 10px',
              borderBottom: `3px solid ${blankColor}`,
              color: blankColor,
              fontWeight: 700,
              fontSize: 22,
              fontFamily: READING,
            }}
            aria-label={value || t('fill.blankLabel')}
          >
            {value || '   '}
          </span>
        ) : (
          /* Free-type mode: inline input */
          <input
            ref={inputRef}
            value={value}
            disabled={!isAnswering}
            aria-label={t('fill.inputLabel')}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={t('fill.placeholder')}
            style={{
              fontFamily: READING,
              fontWeight: 700,
              fontSize: 22,
              color: blankColor,
              minWidth: 140,
              width: `${Math.max(7, value.length + 2)}ch`,
              border: 'none',
              borderBottom: `3px solid ${blankColor}`,
              background: 'transparent',
              textAlign: 'center',
              outline: 'none',
              padding: '0 6px',
            }}
          />
        )}

        <span>{after}</span>
      </div>

      {/* Word bank chips */}
      {hasWordBank && (
        <div className="flex flex-wrap gap-[10px]">
          {(content.wordBank ?? []).map((word, i) => {
            const s = getChipStyle(word, value, reveal, ok, accent, accentSoft);
            return (
              <button
                key={word}
                disabled={!isAnswering}
                onClick={() => isAnswering && onValueChange(value === word ? '' : word)}
                style={{
                  padding: '11px 22px',
                  borderRadius: 10,
                  cursor: isAnswering ? 'pointer' : 'default',
                  border: `2px solid ${s.border}`,
                  background: s.bg,
                  color: s.color,
                  fontFamily: READING,
                  fontSize: 17,
                  fontWeight: 600,
                  transition: 'all 130ms var(--ssz-ease-out)',
                }}
                aria-pressed={value === word}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--ssz-font-ui)',
                    fontWeight: 700,
                    opacity: 0.5,
                    marginRight: 7,
                  }}
                >
                  {i + 1}
                </span>
                {word}
              </button>
            );
          })}
        </div>
      )}

      {/* Explanation matrix — feedback phase only, and only when authored. */}
      {reveal && rationale && <RationaleMatrix rationale={rationale} />}
    </>
  );
}
