'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type {
  ProjectedItem,
  SelfCheckFeedback,
  SelfCheckItem,
  StudentEdits,
  StudentProjection,
} from '@/lib/shared-kernel/error-correction';

import { CharPad } from '@/components/shared/char-pad';

import {
  AudioLockNote,
  AudioSegmentButton,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

/** itemId → the edits the learner made to that sentence. */
export type ErrorCorrectionValue = Record<string, StudentEdits>;

/** What a teacher decided about one sentence, once one has read the submission. */
export interface ErrorCorrectionItemVerdict {
  approved: boolean;
  comment?: string;
}

/** The teacher's decisions, by sentence. */
export type ErrorCorrectionVerdicts = Record<string, ErrorCorrectionItemVerdict>;

export interface ErrorCorrectionBodyProps {
  /**
   * The masked exercise as it left the server: the faulty sentences, tokenised, and how
   * many mistakes each holds. It carries no corrected text — the mistakes are derived
   * from that, so a browser holding it would hold the exercise's answer.
   */
  projection: StudentProjection;
  instruction?: string;
  value: ErrorCorrectionValue;
  onValueChange: (value: ErrorCorrectionValue) => void;
  /** Reports whether every sentence has been touched, which is what allows submitting. */
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  mode: RunnerMode;
  accent: string;
  /**
   * Set while the runner is pointing out that sentences are still untouched — the
   * learner pressed the primary action too early.
   */
  pointOut?: boolean;
  /**
   * The listening layer, when the exercise has one (plan 56 phase 6).
   *
   * The high-value shape here is dictation-with-corrections: the clip is the passage read
   * *correctly*, and the text on screen is not. That is also why this type has an audio
   * rule of its own — a transcript shown from the start would be the answers on screen
   * (`transcriptGivesAway`, enforced in the builder and in publish preflight).
   */
  audio?: ExerciseAudioEngine;
  /** What the clip said, delivered with the key once the work is in. */
  audioTranscript?: { transcript: string; translation: string } | null;
  /**
   * The last self-check the server answered, if the learner has asked for one. Counts
   * only: how many mistakes are corrected per sentence, and how many edits landed where
   * there was no mistake. Which words are wrong is not in here and must not be — that
   * stays withheld until the work is graded (BEHAVIOR §C.1).
   */
  selfCheck?: SelfCheckFeedback | null;
  /**
   * What a teacher decided, per sentence, once one has read the submission.
   *
   * This is the only place this template ever says that a correction was wrong. The
   * engine may not — the auto-check of this template only ever approves — so the words
   * here are a person's, and where they wrote none the card says only that the sentence
   * was not counted (plan 47 §4.1).
   */
  verdicts?: ErrorCorrectionVerdicts | null;
}

const READING = 'var(--ssz-font-reading)';
/** BEHAVIOR §B: every hit area is comfortably tappable, on a phone included. */
const HIT_MIN_HEIGHT = 30;

const EMPTY: StudentEdits = { marked: {}, fix: {}, ins: {} };

/** The letters an English or a US layout does not have — `flow.keyboard`. */
const NORWEGIAN_CHARS = ['æ', 'ø', 'å'] as const;

const editsOf = (value: ErrorCorrectionValue, itemId: string): StudentEdits =>
  value[itemId] ?? EMPTY;

/** How many changes the learner has made to one sentence. */
function changeCount(edits: StudentEdits): number {
  const marked = Object.values(edits.marked).filter(Boolean).length;
  const inserted = Object.values(edits.ins).filter((word) => word.trim() !== '').length;
  return marked + inserted;
}

const isTouched = (edits: StudentEdits): boolean => changeCount(edits) > 0;

/**
 * What one word looks like before anything has been checked.
 *
 * These are the only colours in this component, and they say what the *learner* did —
 * never whether it was right. Which words are wrong is not known here and must not be:
 * the server withholds it until the work is submitted (BEHAVIOR §C.1).
 */
type WordState = 'plain' | 'kept' | 'edited' | 'removed';

function wordState(edits: StudentEdits, index: number, word: string): WordState {
  if (edits.marked[index] !== true) return 'plain';
  const fix = edits.fix[index];
  if (fix === undefined) return 'kept';
  if (fix.trim() === '') return 'removed';
  return fix.trim() === word ? 'kept' : 'edited';
}

export function ErrorCorrectionBody({
  projection,
  instruction,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  mode,
  accent,
  pointOut = false,
  selfCheck = null,
  verdicts = null,
  audio,
  audioTranscript = null,
}: ErrorCorrectionBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const audioOn = audio !== undefined && audio.audio.enabled;
  const locked = audioOn && audio.gated;
  // The gate joins the expression every card already reads, rather than adding a second.
  const interactive = phase === 'answering' && !locked;

  const selfCheckByItem = useMemo(() => {
    const byItem = new Map<string, SelfCheckItem>();
    for (const item of selfCheck?.items ?? []) byItem.set(item.itemId, item);
    return byItem;
  }, [selfCheck]);

  const touchedCount = useMemo(
    () => projection.items.filter((item) => isTouched(editsOf(value, item.id))).length,
    [projection.items, value],
  );

  useEffect(() => {
    onAnswerChange(projection.items.length > 0 && touchedCount === projection.items.length);
  }, [onAnswerChange, projection.items.length, touchedCount]);

  function update(itemId: string, change: (edits: StudentEdits) => StudentEdits) {
    const current = editsOf(value, itemId);
    onValueChange({
      ...value,
      [itemId]: change({
        marked: { ...current.marked },
        fix: { ...current.fix },
        ins: { ...current.ins },
      }),
    });
  }

  return (
    <div>
      {instruction !== undefined && instruction !== '' && <Instr>{instruction}</Instr>}

      {audioOn && (
        <div className="mb-3">
          <ExerciseAudioPlayer eng={audio} interactive={phase === 'answering'} />
          {locked && <AudioLockNote itemNoun={t('audio.itemNoun.sentences')} />}
        </div>
      )}

      {projection.note !== '' && (
        <p className="mb-3 text-[13px] text-(--ssz-text-secondary)">{projection.note}</p>
      )}

      {projection.totalErrors !== undefined && (
        <p className="mb-4 text-[13px] font-semibold text-(--ssz-text-secondary)">
          {t('errorCorrection.toFind', { count: projection.totalErrors })}
        </p>
      )}

      {projection.items.length > 1 && (
        <p className="mb-3 text-[12.5px] text-(--ssz-text-muted)">
          {t('errorCorrection.progress', {
            touched: touchedCount,
            total: projection.items.length,
          })}
        </p>
      )}

      <ol className="flex flex-col gap-4">
        {projection.items.map((item, index) => {
          const edits = editsOf(value, item.id);
          const feedback = selfCheckByItem.get(item.id);

          return (
            <EcCard
              key={item.id}
              item={item}
              label={
                projection.mode === 'passage'
                  ? t('errorCorrection.passageLabel')
                  : t('taskNumber', { n: index + 1 })
              }
              passage={projection.mode === 'passage'}
              keyboard={projection.flow.keyboard}
              showSpanCount={projection.flow.showSpanCount}
              edits={edits}
              interactive={interactive}
              accent={accent}
              mode={mode}
              untouched={pointOut && !isTouched(edits)}
              {...(audioOn ? { audioEngine: audio } : {})}
              {...(feedback === undefined ? {} : { feedback })}
              verdict={verdicts?.[item.id] ?? null}
              onChange={(change) => update(item.id, change)}
            />
          );
        })}
      </ol>

      {interactive && (
        <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)">{t('errorCorrection.howTo')}</p>
      )}

      {audioOn && (
        <AudioTranscript
          audio={audio.audio}
          revealed={audioTranscript !== null}
          delivered={audioTranscript}
        />
      )}
    </div>
  );
}

interface EcCardProps {
  item: ProjectedItem;
  label: string;
  passage: boolean;
  keyboard: boolean;
  showSpanCount: boolean;
  edits: StudentEdits;
  interactive: boolean;
  accent: string;
  mode: RunnerMode;
  untouched: boolean;
  /** The clip engine, when the exercise has one — for this sentence's fragment chip. */
  audioEngine?: ExerciseAudioEngine;
  feedback?: SelfCheckItem;
  /** What the teacher decided about this sentence, once one has. */
  verdict: ErrorCorrectionItemVerdict | null;
  onChange: (change: (edits: StudentEdits) => StudentEdits) => void;
}

/**
 * One sentence with everything that belongs to it: the editor, its tools, and whatever
 * the last self-check said about it.
 *
 * The card owns which word is open for editing, rather than the editor doing it, because
 * the æøå pad below the sentence needs to know whether there is a field to write into at
 * all — a pad that looks live and does nothing is worse than one that is plainly off.
 */
function EcCard({
  item,
  label,
  passage,
  keyboard,
  showSpanCount,
  edits,
  interactive,
  accent,
  mode,
  untouched,
  audioEngine,
  feedback,
  verdict,
  onChange,
}: EcCardProps) {
  const t = useTranslations('ExerciseRunner');
  /** `w:3` while rewriting word 3, `s:2` while inserting at slot 2. */
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <li
      className="rounded-2xl border px-4 py-3 transition-colors"
      style={{
        borderColor: untouched ? accent : 'var(--ssz-border-default)',
        background: untouched ? modeAccentSoft(mode) : 'var(--ssz-bg-surface)',
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[12px] font-bold text-(--ssz-text-muted)">{label}</span>
        <div className="flex items-center gap-3">
          {/*
            How many mistakes *this* card holds, and only in `passage` — where the card is
            the whole text, so it says no more than the total already does. Across separate
            sentences it would say which ones are clean, and that is a different and much
            larger hint than "there are three mistakes here somewhere": the learner could
            stop reading four of five sentences. The handoff draws the line in the same
            place (BEHAVIOR §B, ec/preview.jsx).
          */}
          {passage && item.errorCount !== undefined && (
            <span className="text-[12px] text-(--ssz-text-muted)">
              {t('errorCorrection.inThis', { count: item.errorCount })}
            </span>
          )}
          {/* A teacher's word outranks the machine's silence — this template's auto-check
              never says a correction is wrong, so once a person has, their word is the
              only one on screen. */}
          {verdict !== null && (
            <span
              className="text-[12px] font-semibold"
              style={{
                color: verdict.approved
                  ? 'var(--ssz-feedback-ok-fg)'
                  : 'var(--ssz-feedback-no-fg)',
              }}
            >
              {verdict.approved ? t('errorCorrection.itemCounted') : t('errorCorrection.itemNotCounted')}
            </span>
          )}
        </div>
      </div>

      {/* This sentence's line of the clip, when the author timed it. Free to replay: a
          fragment spends no listen (BEHAVIOR §8). */}
      {audioEngine !== undefined && (
        <AudioSegmentButton
          eng={audioEngine}
          segment={audioEngine.segments[item.id] ?? null}
          disabled={!interactive}
        />
      )}

      <EcSentence
        item={item}
        edits={edits}
        passage={passage}
        interactive={interactive}
        accent={accent}
        editing={editing}
        onEditingChange={setEditing}
        onChange={onChange}
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {keyboard && interactive && (
          <CharPad
            chars={NORWEGIAN_CHARS}
            disabled={editing === null}
            label={t('errorCorrection.charPad')}
          />
        )}
        {item.hint !== undefined && item.hint !== '' && <HintDisclosure hint={item.hint} />}
        {item.errorTypes !== undefined && item.errorTypes.length > 0 && (
          <span className="text-[12px] text-(--ssz-text-muted)">
            {t('errorCorrection.types', {
              types: item.errorTypes.map((type) => t(`errorCorrection.type.${type}`)).join(', '),
            })}
          </span>
        )}
        <span className="text-[12px] text-(--ssz-text-muted)">
          {t('errorCorrection.changes', { count: changeCount(edits) })}
        </span>
        {interactive && changeCount(edits) > 0 && (
          <button
            type="button"
            className="text-[12px] font-semibold underline underline-offset-2"
            style={{ color: 'var(--ssz-text-secondary)' }}
            onClick={() => onChange(() => ({ marked: {}, fix: {}, ins: {} }))}
          >
            {t('errorCorrection.reset')}
          </button>
        )}
      </div>

      {feedback !== undefined && (
        <SelfCheckNote feedback={feedback} showSpanCount={showSpanCount} />
      )}

      {/*
        Once a teacher has read it, their words replace the header badge above as the
        explanation — and where they wrote none, the card says only that the sentence was
        not counted. Inventing a reason here is the one thing this template must never do.
      */}
      {verdict !== null &&
        (verdict.comment !== undefined && verdict.comment.trim() !== '' ? (
          <p className="mt-2 text-[12.5px] text-(--ssz-text-secondary)">{verdict.comment}</p>
        ) : (
          !verdict.approved && (
            <p className="mt-2 text-[12.5px] text-(--ssz-text-muted)">
              {t('errorCorrection.itemNotCountedPlain')}
            </p>
          )
        ))}
    </li>
  );
}

interface SelfCheckNoteProps {
  feedback: SelfCheckItem;
  showSpanCount: boolean;
}

/**
 * What one sentence's self-check is allowed to say.
 *
 * Every line here is a number or a mistake type. There is deliberately no verdict: the
 * auto-check of this template only ever approves, and a "not good enough" said here,
 * before the work is even handed in, would be a rejection the template does not make.
 * There is also no pointing — "one mistake is still left" never becomes "*this* word".
 */
function SelfCheckNote({ feedback, showSpanCount }: SelfCheckNoteProps) {
  const t = useTranslations('ExerciseRunner');
  const { fixedCount, spanCount, remainingTypes, strayEdits } = feedback;
  const left = spanCount - fixedCount;

  const headline =
    spanCount === 0
      ? t('errorCorrection.selfCheck.itemClean')
      : left === 0
        ? t('errorCorrection.selfCheck.itemAll')
        : fixedCount === 0
          ? t('errorCorrection.selfCheck.itemNone')
          : t('errorCorrection.selfCheck.itemSome', { fixed: fixedCount, total: spanCount });

  return (
    <div
      className="mt-2 rounded-xl border px-3 py-2"
      style={{
        borderColor: 'var(--ssz-border-default)',
        background: 'var(--ssz-bg-surface-subtle)',
      }}
    >
      <p className="text-[12.5px] font-semibold text-(--ssz-text-primary)">{headline}</p>

      {/* Pips repeat the count in a form that can be taken in at a glance; with a single
          mistake they would say nothing the headline has not, so they start at two. */}
      {showSpanCount && spanCount > 1 && (
        <span className="mt-1 flex items-center gap-1">
          {feedback.fixedSpans.map((fixed, index) => (
            <i
              key={index}
              aria-hidden
              className="block h-2 w-2 rounded-full"
              style={{
                background: fixed ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-border-strong)',
              }}
            />
          ))}
          <span className="ml-1 text-[12px] text-(--ssz-text-muted)">
            {t('errorCorrection.selfCheck.tally', { fixed: fixedCount, total: spanCount })}
          </span>
        </span>
      )}

      {left > 0 && (
        <p className="mt-1 text-[12px] text-(--ssz-text-secondary)">
          {remainingTypes !== undefined && remainingTypes.length > 0
            ? t('errorCorrection.selfCheck.remainingWithTypes', {
                count: left,
                types: remainingTypes.map((type) => t(`errorCorrection.type.${type}`)).join(', '),
              })
            : t('errorCorrection.selfCheck.remaining', { count: left })}
        </p>
      )}

      {/* Said out loud because it is otherwise the commonest silent reason for an answer
          to come back rejected: everything was corrected, and something else was too. */}
      {strayEdits > 0 && (
        <p className="mt-1 text-[12px] text-(--ssz-text-secondary)">
          {t('errorCorrection.selfCheck.stray', { count: strayEdits })}
        </p>
      )}
    </div>
  );
}

interface EcSentenceProps {
  item: ProjectedItem;
  edits: StudentEdits;
  passage: boolean;
  interactive: boolean;
  accent: string;
  /** `w:3` while rewriting word 3, `s:2` while inserting at slot 2; `null` when idle. */
  editing: string | null;
  onEditingChange: (editing: string | null) => void;
  onChange: (change: (edits: StudentEdits) => StudentEdits) => void;
}

/**
 * The word editor — the one interaction this template has.
 *
 * Tap a word to rewrite it, tap between two words to insert one. Rewriting the whole
 * sentence in a textarea would be easier to build and would throw away the only thing
 * that makes this template gradable: with edits, "which mistake did they find?" is a
 * fact; with a rewritten sentence it is a guess.
 */
function EcSentence({
  item,
  edits,
  passage,
  interactive,
  accent,
  editing,
  onEditingChange: setEditing,
  onChange,
}: EcSentenceProps) {
  const t = useTranslations('ExerciseRunner');

  const commitWord = (index: number, word: string, text: string) => {
    onChange((current) => {
      const trimmed = text.trim();
      // Unchanged text is not an edit: leaving the word marked would claim a
      // correction the learner did not make, and the count they are shown is a count
      // of corrections.
      if (trimmed === word) {
        delete current.marked[index];
        delete current.fix[index];
        return current;
      }
      current.marked[index] = true;
      current.fix[index] = trimmed;
      return current;
    });
    setEditing(null);
  };

  const commitInsert = (slot: number, text: string) => {
    onChange((current) => {
      const trimmed = text.trim();
      if (trimmed === '') delete current.ins[slot];
      else current.ins[slot] = trimmed;
      return current;
    });
    setEditing(null);
  };

  const unmark = (index: number) => {
    onChange((current) => {
      delete current.marked[index];
      delete current.fix[index];
      return current;
    });
  };

  return (
    <p
      className={passage ? 'flex flex-wrap items-center gap-y-1' : 'flex flex-wrap items-center'}
      style={{
        fontFamily: READING,
        fontSize: passage ? 16 : 17,
        lineHeight: passage ? 1.9 : 1.7,
      }}
      data-passage={passage ? 'true' : undefined}
    >
      {item.words.map((word, index) => (
        <span key={`${item.id}-${index}`} className="inline-flex items-center">
          <Slot
            slot={index}
            inserted={edits.ins[index]}
            editing={editing === `s:${index}`}
            interactive={interactive}
            accent={accent}
            onOpen={() => setEditing(`s:${index}`)}
            onCommit={(text) => commitInsert(index, text)}
            onCancel={() => setEditing(null)}
          />
          {editing === `w:${index}` && interactive ? (
            <InlineField
              defaultValue={edits.fix[index] ?? word}
              label={t('errorCorrection.editLabel', { text: word })}
              accent={accent}
              onCommit={(text) => commitWord(index, word, text)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <Word
              word={word}
              display={edits.fix[index]}
              state={wordState(edits, index, word)}
              interactive={interactive}
              accent={accent}
              onOpen={() => setEditing(`w:${index}`)}
              onUnmark={() => unmark(index)}
            />
          )}
        </span>
      ))}
      <Slot
        slot={item.words.length}
        inserted={edits.ins[item.words.length]}
        editing={editing === `s:${item.words.length}`}
        interactive={interactive}
        accent={accent}
        onOpen={() => setEditing(`s:${item.words.length}`)}
        onCommit={(text) => commitInsert(item.words.length, text)}
        onCancel={() => setEditing(null)}
      />
    </p>
  );
}

interface WordProps {
  word: string;
  display: string | undefined;
  state: WordState;
  interactive: boolean;
  accent: string;
  onOpen: () => void;
  onUnmark: () => void;
}

function Word({ word, display, state, interactive, accent, onOpen, onUnmark }: WordProps) {
  const t = useTranslations('ExerciseRunner');
  const shown = state === 'edited' && display !== undefined ? display : word;

  return (
    <button
      type="button"
      disabled={!interactive}
      data-state={state}
      title={interactive ? t('errorCorrection.editLabel', { text: word }) : undefined}
      aria-label={t('errorCorrection.wordLabel', { text: shown })}
      onClick={onOpen}
      onContextMenu={(event) => {
        // Right-click undoes the marking. A marked word the learner changed their mind
        // about otherwise has no way back except retyping it exactly.
        if (state === 'plain') return;
        event.preventDefault();
        onUnmark();
      }}
      className="rounded-md px-1 disabled:cursor-default"
      style={{
        minHeight: HIT_MIN_HEIGHT,
        color: state === 'removed' ? 'var(--ssz-feedback-no-fg)' : 'var(--ssz-text-primary)',
        fontWeight: state === 'edited' ? 600 : 400,
        textDecoration:
          state === 'removed'
            ? 'line-through'
            : state === 'edited'
              ? `underline 2px ${accent}`
              : state === 'kept'
                ? 'underline 2px var(--ssz-border-strong)'
                : undefined,
        textUnderlineOffset: 4,
      }}
    >
      {shown}
    </button>
  );
}

interface SlotProps {
  slot: number;
  inserted: string | undefined;
  editing: boolean;
  interactive: boolean;
  accent: string;
  onOpen: () => void;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/** The insertion point between two words — a thin strip that widens on hover or focus. */
function Slot({
  slot,
  inserted,
  editing,
  interactive,
  accent,
  onOpen,
  onCommit,
  onCancel,
}: SlotProps) {
  const t = useTranslations('ExerciseRunner');

  if (editing && interactive) {
    return (
      <InlineField
        defaultValue={inserted ?? ''}
        label={t('errorCorrection.insertLabel', { position: slot + 1 })}
        accent={accent}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }

  if (inserted !== undefined && inserted.trim() !== '') {
    return (
      <button
        type="button"
        disabled={!interactive}
        onClick={onOpen}
        aria-label={t('errorCorrection.insertedLabel', { text: inserted })}
        className="mx-0.5 rounded-md px-1 font-semibold disabled:cursor-default"
        style={{
          minHeight: HIT_MIN_HEIGHT,
          color: accent,
          textDecoration: `underline 2px ${accent}`,
          textUnderlineOffset: 4,
        }}
      >
        {inserted}
      </button>
    );
  }

  if (!interactive) return <span className="inline-block w-1" />;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('errorCorrection.insertLabel', { position: slot + 1 })}
      className="group mx-px inline-flex items-center justify-center rounded-sm"
      style={{ minHeight: HIT_MIN_HEIGHT, width: 10 }}
    >
      <span
        aria-hidden
        className="block h-4 w-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100"
        style={{ background: accent }}
      />
    </button>
  );
}

interface InlineFieldProps {
  defaultValue: string;
  label: string;
  accent: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * The field a word turns into. Committed on Enter or blur, abandoned on Escape.
 *
 * The text starts selected so that the commonest edit — replace this word — is one
 * keystroke, while the second commonest — change its ending — is one arrow key away.
 */
function InlineField({ defaultValue, label, accent, onCommit, onCancel }: InlineFieldProps) {
  const [text, setText] = useState(defaultValue);
  const cancelled = useRef(false);

  return (
    <input
      autoFocus
      value={text}
      aria-label={label}
      size={Math.max(4, text.length + 1)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (cancelled.current) return;
        onCommit(text);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(text);
        }
        if (event.key === 'Escape') {
          cancelled.current = true;
          onCancel();
        }
      }}
      className="mx-0.5 rounded-lg border-2 px-1.5 py-0.5 focus-visible:outline-none"
      style={{
        minHeight: HIT_MIN_HEIGHT,
        fontFamily: READING,
        fontSize: 16,
        borderColor: accent,
        background: 'var(--ssz-bg-surface)',
        color: 'var(--ssz-text-primary)',
      }}
    />
  );
}

function HintDisclosure({ hint }: { hint: string }) {
  const t = useTranslations('ExerciseRunner');
  const [open, setOpen] = useState(false);

  if (open) return <span className="text-[12.5px] text-(--ssz-text-secondary)">{hint}</span>;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-[12px] font-semibold underline underline-offset-2"
      style={{ color: 'var(--ssz-text-secondary)' }}
    >
      {t('errorCorrection.showHint')}
    </button>
  );
}
