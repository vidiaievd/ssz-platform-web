'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AnswerNoteMarker, buildAnswerNote, type Rationale, type WordNotes } from './answer-note';
import {
  AudioLockNote,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';

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
  /** Shared per-word notes, used by the feedback marker. */
  wordNotes?: WordNotes;
}

export interface FillExpectedAnswers {
  /** Map of blank index ("1") → correct answer string. */
  answers: Record<string, string>;
  explanation?: string;
}

export type { RationaleVerdict, RationaleOption } from './answer-note';

/** The rationale shape is shared with the other blank-based templates. */
export type FillRationale = Rationale;

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
   * Optional teaching aid, surfaced by a marker beside the blank in the
   * feedback phase. Omitted for exercises authored without one — the body
   * behaves exactly as before.
   */
  rationale?: FillRationale;
  /** The accepted answer, so the marker can say why it is the one. */
  correctAnswer?: string;
  /** Once set, a missed blank's note may name the answer and quote the rule. */
  revealed?: boolean;
  /**
   * The listening layer, when the exercise has one (plan 56 phase 6).
   *
   * This template has no builder — it lives on the old shared form — so it gets the
   * runner half only. That is not a gap: the layer is a property of the document, and a
   * document written by hand or by a seed carries it just as well.
   */
  audio?: ExerciseAudioEngine;
  /** What the clip said, delivered with the key once the blank has been checked. */
  audioTranscript?: { transcript: string; translation: string } | null;
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
  correctAnswer = '',
  revealed = false,
  audio,
  audioTranscript = null,
}: FillBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const accentSoft = modeAccentSoft(mode);
  const reveal = phase === 'feedback';
  const audioOn = audio !== undefined && audio.audio.enabled;
  const locked = audioOn && audio.gated;
  // The gate joins the expression every control here already reads, rather than adding a
  // second one: the blank, the word chips and the keyboard shortcut all ask `isAnswering`.
  const isAnswering = phase === 'answering' && !locked;
  const hasWordBank = Array.isArray(content.wordBank) && content.wordBank.length > 0;
  const { before, after } = parseBlanks(content.textWithBlanks);
  const inputRef = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  /* Feedback marker content — nothing authored means no marker at all. */
  const answerNote = buildAnswerNote({
    rationale,
    wordNotes: content.wordNotes,
    chosen: value,
    correct: correctAnswer,
    chosenCorrect: ok === true,
    revealed,
  });

  /* Once the answer is unlocked it takes the blank's place, with the learner's
     word struck out beside it. */
  const showAnswer = reveal && revealed && ok === false && correctAnswer !== '';

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

      {audioOn && (
        <div className="mb-3">
          <ExerciseAudioPlayer eng={audio} interactive={phase === 'answering'} />
          {locked && <AudioLockNote />}
        </div>
      )}

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

        {showAnswer ? (
          <span className="inline-flex items-baseline gap-2">
            <span
              style={{
                borderBottom: `3px solid ${OK_LINE}`,
                color: OK_FG,
                fontWeight: 700,
                fontFamily: READING,
              }}
            >
              {correctAnswer}
            </span>
            {value !== '' && (
              <span style={{ color: NO_FG, fontSize: 15 }}>
                <span className="sr-only">{t('fill.yourAnswer')}: </span>
                <s>{value}</s>
              </span>
            )}
          </span>
        ) : hasWordBank ? (
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

        {/* Marker revealing why this blank's answer is the answer. */}
        {reveal && ok !== null && answerNote && (
          <AnswerNoteMarker
            note={answerNote}
            correct={ok}
            open={noteOpen}
            onToggle={() => setNoteOpen((v) => !v)}
          />
        )}
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

      {audioOn && (
        <AudioTranscript
          audio={audio.audio}
          revealed={audioTranscript !== null}
          delivered={audioTranscript}
        />
      )}
    </>
  );
}
