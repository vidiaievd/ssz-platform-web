'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';

/** Verdict for one analysed option of a blank. */
export type RationaleVerdict = 'correct' | 'acceptable' | 'wrong';

export interface RationaleOption {
  text: string;
  verdict: RationaleVerdict;
  note?: string;
}

/**
 * Optional teaching aid authored per blank. `explanation` is specific to this
 * sentence; `options` carries per-candidate notes. Purely presentational — it
 * never takes part in grading.
 */
export interface Rationale {
  explanation?: string;
  options?: RationaleOption[];
}

/**
 * Notes about the bank words themselves, shared by every blank of an exercise.
 * In a drill on `at` / `om` / question words, "om — only for yes/no questions"
 * holds in all ten sentences, so it is authored once instead of per blank.
 */
export type WordNotes = Record<string, string>;

/** What the marker reveals: the rule here, plus one line per word that matters. */
export interface AnswerNote {
  explanation?: string;
  chosen?: { text: string; note?: string };
  correct?: { text: string; note?: string };
}

const norm = (s: string) => s.trim().toLowerCase();

export interface BuildAnswerNoteInput {
  rationale?: Rationale;
  wordNotes?: WordNotes;
  /** What the learner picked; empty when the blank was left open. */
  chosen: string;
  /** The accepted answer for this blank. */
  correct: string;
  chosenCorrect: boolean;
  /**
   * Set once the learner has spent their attempts (or asked to see it): the
   * note may then name the answer and quote the rule.
   */
  revealed?: boolean;
}

/**
 * Collapses the authored material into what one blank should say *right now*.
 *
 * A missed blank gets only the reason its own word doesn't work. The accepted
 * answer stays hidden — and so does the sentence explanation, which in practice
 * names that answer ("statements take «at»"). Handing it over on the first miss
 * ends the exercise; the learner gets another go at the rule instead, and the
 * full note only once `revealed`.
 *
 * Exercise-level `wordNotes` win over a per-blank option note: they are the
 * form authors are expected to fill in, and the older `options` list stays
 * readable so exercises written before it keep working.
 */
export function buildAnswerNote({
  rationale,
  wordNotes,
  chosen,
  correct,
  chosenCorrect,
  revealed = false,
}: BuildAnswerNoteInput): AnswerNote | null {
  const noteFor = (word: string): string | undefined => {
    if (word === '') return undefined;
    const direct = wordNotes?.[word] ?? wordNotes?.[norm(word)];
    if (direct) return direct;
    return rationale?.options?.find((o) => norm(o.text) === norm(word))?.note;
  };

  const missed = !chosenCorrect && chosen !== '';

  if (!chosenCorrect && !revealed) {
    const note = missed ? noteFor(chosen) : undefined;
    // Nothing written about this word — then there is nothing to reveal.
    return note === undefined ? null : { chosen: { text: chosen, note } };
  }

  const note: AnswerNote = {
    ...(rationale?.explanation ? { explanation: rationale.explanation } : {}),
    ...(missed ? { chosen: { text: chosen, note: noteFor(chosen) } } : {}),
    ...(correct !== '' ? { correct: { text: correct, note: noteFor(correct) } } : {}),
  };
  const hasSomethingToSay =
    note.explanation !== undefined ||
    note.chosen?.note !== undefined ||
    note.correct?.note !== undefined;
  return hasSomethingToSay ? note : null;
}

const OK_BG = 'var(--ssz-feedback-ok-bg)';
const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_FG = 'var(--ssz-feedback-ok-fg)';
const NO_BG = 'var(--ssz-feedback-no-bg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_FG = 'var(--ssz-feedback-no-fg)';
const READING = 'var(--ssz-font-reading)';

interface AnswerNoteMarkerProps {
  note: AnswerNote;
  /** Tints the marker to match the blank it belongs to. */
  correct: boolean;
  /**
   * Controlled by the body so that only one note is open at a time — with a
   * marker on every blank, stacked open panels bury the sentences.
   */
  open: boolean;
  onToggle: () => void;
  /** Names the blank for screen readers, e.g. "Sentence 3". */
  label?: string;
}

function NoteLine({ word, note, ok }: { word: string; note?: string; ok: boolean }) {
  const t = useTranslations('ExerciseRunner');
  return (
    <span
      className="mt-1.5 block text-[13.5px] leading-[1.5]"
      style={{ color: 'var(--ssz-text-secondary)' }}
    >
      <span aria-hidden="true" style={{ color: ok ? OK_FG : NO_FG }}>
        {ok ? '✔' : '✗'}{' '}
      </span>
      <span className="sr-only">{ok ? t('fill.verdictCorrect') : t('fill.verdictWrong')}: </span>
      <strong style={{ color: ok ? OK_FG : NO_FG, fontFamily: READING }}>{word}</strong>
      {!ok && <span className="ml-1.5 text-[11px] uppercase">{t('fill.yourAnswer')}</span>}
      {note && <> — {note}</>}
    </span>
  );
}

/**
 * A small button next to a checked blank that reveals why its answer is the
 * answer. Deliberately not a hover tooltip: the panel has to be reachable by
 * keyboard and by touch, and a ten-sentence drill would otherwise hide every
 * explanation behind a pointer.
 *
 * Both callers lay their sentence out in a wrapping flex row, so the panel
 * claims a full row of its own and lands under the sentence it explains.
 */
export function AnswerNoteMarker({
  note,
  correct,
  open,
  onToggle,
  label,
}: AnswerNoteMarkerProps) {
  const t = useTranslations('ExerciseRunner');
  const panelId = useId();

  const line = correct ? OK_LINE : NO_LINE;
  const fg = correct ? OK_FG : NO_FG;
  const bg = correct ? OK_BG : NO_BG;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ? `${t('fill.rationaleTitle')} — ${label}` : t('fill.rationaleTitle')}
        className="focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
        style={{
          flexShrink: 0,
          width: 17,
          height: 17,
          borderRadius: '50%',
          border: `1.5px solid ${line}`,
          background: open ? line : 'transparent',
          color: open ? 'var(--ssz-text-on-brand)' : fg,
          fontFamily: 'var(--ssz-font-ui)',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ?
      </button>

      {open && (
        <span
          id={panelId}
          className="mt-2 block rounded-xl border px-3.5 py-3"
          style={{
            flexBasis: '100%',
            borderColor: line,
            background: bg,
          }}
        >
          {note.explanation && (
            <span
              className="block text-[14.5px] leading-relaxed"
              style={{ color: 'var(--ssz-text-primary)', fontFamily: READING }}
            >
              {note.explanation}
            </span>
          )}
          {note.chosen && (
            <NoteLine word={note.chosen.text} note={note.chosen.note} ok={false} />
          )}
          {note.correct && <NoteLine word={note.correct.text} note={note.correct.note} ok />}
        </span>
      )}
    </>
  );
}
