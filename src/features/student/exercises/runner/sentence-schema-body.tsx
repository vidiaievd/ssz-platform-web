'use client';

import { BookOpen, CheckCircle, Eye, Info, RotateCcw, SkipForward, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import type {
  Feedback,
  Placement,
  ProjectedRow,
  Settings,
  StudentResult,
} from '@/lib/shared-kernel/sentence-schema';

import { fitsAsColumns, SchemaBoard } from './schema-board';
import { WordBank } from './word-bank';

/**
 * Where the runner is in one sentence.
 *
 * `placing` and `checked` alternate for as long as the learner likes — being wrong is a
 * step, not a verdict. `closed` is the sentence solved or revealed, and the board locks.
 * `done` belongs to the set.
 *
 * Not `RunnerPhase`: the shared `answering | feedback` pair describes an exercise checked
 * once, and this one is checked as often as it takes.
 */
export type SentenceSchemaPhase = 'placing' | 'checked' | 'closed' | 'done';

export interface SentenceSchemaBodyProps {
  /** The sentence as the server projected it — fields, the shuffled bank, the prompt. */
  row: ProjectedRow;
  /** The switches the author set. Nothing here decides them. */
  settings: Settings;
  /** Which sentence of the set is on screen, 0-based, and how many there are. */
  index: number;
  total: number;
  /** Instruction in the learner's language; the projection's own is the fallback. */
  instruction?: string;
  placement: Placement;
  onPlacementChange: (placement: Placement) => void;
  phase: SentenceSchemaPhase;
  /** Which check this is, 1-based — the `Forsøk N` counter. */
  attempt: number;
  /**
   * The server's marks for the last check.
   *
   * Nothing here grades. Which field a piece belongs in is the answer key, and the note
   * under the board is resolved from the key too — the author's own words for the piece
   * that went wrong, or a code to render when they wrote none (plan 52 §3.2).
   */
  result: StudentResult | null;
  /** How the set came out: solved, shown, and put aside without an answer. */
  tally: { solved: number; revealed: number; skipped: number };
  /** This sentence has come back around after being put aside. */
  deferred?: boolean;
  /**
   * Nothing follows this sentence — so the way on says `Finish` rather than `Next`.
   *
   * Decided by the caller, not by `index + 1 === total`: once a sentence can be put aside
   * and offered again, position in the list stops being the same question as "is this the
   * end", and the arithmetic answer is wrong exactly when a deferred one is still owed.
   */
  lastSentence?: boolean;
  sending?: boolean;
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onReveal: () => void;
  onNext: () => void;
  /** Put this sentence aside and carry on. Absent where the set cannot be re-ordered. */
  onSkip?: () => void;
  /** Play the set again. Absent where a fresh attempt cannot be had. */
  onRestart?: () => void;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';

/**
 * `sentence_schema`, as the learner plays it: one sentence at a time onto the field board.
 *
 * Three ways in, and no switch between them (BEHAVIOR, "Student · placing"): tap a piece
 * then a field, tap a field then a piece, or drag — including from one field to another.
 * A piece already placed goes back to the bank by its own ×, or by tapping it in the bank
 * where it still sits.
 *
 * The marks are transient. Any placement after a check drops them, because a marked board
 * that is then edited is a board whose marks are about something else — the same rule as
 * `word_bank_gap_fill`.
 *
 * What the learner may do about being wrong is the whole design of this type: `Rett opp`
 * keeps every piece that was right, clears the rest and counts the attempt up. Unlimited.
 * `Vis riktig skjema` ends the sentence instead — the board fills in, locks, and the
 * sentence is not credited, because it was shown rather than solved.
 *
 * Presentational and controlled, like the other pool-to-slot bodies: handed a projection,
 * a placement and a verdict, it draws them and reports intent. Every hook runs before the
 * empty state returns — a set with nothing deliverable in it must render, not crash
 * (IMPLEMENTATION.md warns about exactly this, which means someone has been bitten).
 */
export function SentenceSchemaBody({
  row,
  settings,
  index,
  total,
  instruction,
  placement,
  onPlacementChange,
  phase,
  attempt,
  result,
  tally,
  sending = false,
  error = null,
  interactive = true,
  onCheck,
  onRetry,
  onReveal,
  onNext,
  onSkip,
  onRestart,
  accent,
  deferred = false,
  lastSentence,
}: SentenceSchemaBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const [root, width] = useContainerWidth();
  const [armedItem, setArmedItem] = useState<string | null>(null);
  const [armedField, setArmedField] = useState<string | null>(null);

  const locked = phase === 'closed' || phase === 'done' || !interactive;
  const used = Object.values(placement).flat();
  const textOf = (itemId: string) => row.bank.find((item) => item.id === itemId)?.text ?? '';
  const placedChunks = used.length;

  if (phase === 'done') {
    return (
      <div ref={root}>
        <div
          className="flex flex-col items-start gap-3 rounded-2xl border p-5"
          style={{ background: 'var(--ssz-bg-surface)', borderColor: 'var(--ssz-border-default)' }}
        >
          <CheckCircle size={22} aria-hidden="true" style={{ color: accent }} />
          <p className="m-0 text-[15px] font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
            {t('sentenceSchema.setDone', { count: total })}
          </p>
          <p className="m-0 text-[13.5px]" style={{ color: 'var(--ssz-text-muted)' }}>
            {tally.skipped > 0
              ? t('sentenceSchema.setTallySkipped', {
                  solved: tally.solved,
                  revealed: tally.revealed,
                  skipped: tally.skipped,
                })
              : t('sentenceSchema.setTally', {
                  solved: tally.solved,
                  revealed: tally.revealed,
                })}
          </p>
          {onRestart !== undefined && (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-primary)' }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('sentenceSchema.again')}
            </button>
          )}
        </div>
      </div>
    );
  }

  /** Move a piece into a field, from the bank or from another field. */
  function place(itemId: string, fieldId: string) {
    if (locked) return;
    const next: Placement = {};
    for (const [id, items] of Object.entries(placement)) {
      const kept = items.filter((item) => item !== itemId);
      if (kept.length > 0) next[id] = kept;
    }
    next[fieldId] = [...(next[fieldId] ?? []), itemId];
    onPlacementChange(next);
    setArmedItem(null);
    setArmedField(null);
  }

  function take(itemId: string) {
    if (locked) return;
    const next: Placement = {};
    for (const [id, items] of Object.entries(placement)) {
      const kept = items.filter((item) => item !== itemId);
      if (kept.length > 0) next[id] = kept;
    }
    onPlacementChange(next);
  }

  function pressItem(itemId: string) {
    if (locked) return;
    // The piece is on the board: tapping it in the bank is how it comes back.
    if (used.includes(itemId)) {
      take(itemId);
      return;
    }
    if (armedField !== null) {
      place(itemId, armedField);
      return;
    }
    setArmedItem(armedItem === itemId ? null : itemId);
  }

  function pressField(fieldId: string) {
    if (locked) return;
    if (armedItem !== null) {
      place(armedItem, fieldId);
      return;
    }
    setArmedField(armedField === fieldId ? null : fieldId);
  }

  const marks =
    phase === 'checked' && result !== null
      ? { byItem: result.byItem, byField: settings.perField ? result.byField : null }
      : phase === 'closed' && result !== null && result.solved
        ? { byItem: result.byItem, byField: settings.perField ? result.byField : null }
        : null;

  const banner = phase === 'placing' ? null : (result?.banner ?? null);
  const solved = result?.solved === true;
  const revealed = phase === 'closed' && !solved;

  return (
    <div ref={root}>
      {/* `.wb-run-top`: where the learner is, as a rule and a number. It was a sentence
          of bold text, which reads as a heading over the exercise rather than as its
          margin — and the design puts the emphasis on the board, not on the counter. */}
      <div className="mb-2.5 flex items-center gap-2.5">
        {/* `1/5` is what the design shows and all a sighted learner needs beside a bar
            they can see. The sentence it stands for is still said in full, on the bar
            itself — the number alone would be a fraction with no unit read aloud. */}
        <div
          role="img"
          aria-label={t('sentenceSchema.position', { index: index + 1, total })}
          className="h-1 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-bg-muted)' }}
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500"
            style={{ width: `${(index / total) * 100}%`, background: accent }}
          />
        </div>
        <span
          className="shrink-0 text-[12px] tabular-nums"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          {index + 1}/{total}
        </span>
        {attempt > 1 && phase !== 'closed' && (
          <span className="shrink-0 text-[12px]" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.attemptNo', { count: attempt })}
          </span>
        )}
      </div>

      {/* One plain line (`.wb-run-instr`). The shared `Instr` sets it in bold uppercase,
          which is right where an instruction has to compete with a wall of text and wrong
          here, where it sits above a board that is already the loudest thing on screen. */}
      {(instruction !== undefined && instruction !== '') || row.source === '' ? (
        <p className="m-0 mb-2 text-[14px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {instruction !== undefined && instruction !== ''
            ? instruction
            : t('sentenceSchema.defaultInstruction')}
        </p>
      ) : null}

      {/* Which clause type this sentence is (`.ss-clausetag`) — the one piece of the
          design's header we never drew, and the only thing on screen that says why the
          fields are these fields. */}
      <span
        className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px]"
        style={{
          background: 'var(--ssz-bg-subtle)',
          borderColor: 'var(--ssz-border-default)',
          color: 'var(--ssz-text-secondary)',
        }}
      >
        <BookOpen size={12} aria-hidden="true" />
        {t(`sentenceSchema.clause.${row.clause}` as 'sentenceSchema.clause.main')}
      </span>

      {/* Why the set jumped backwards. Without it the order looks broken rather than
          kept: this is the sentence they asked to see again. */}
      {deferred && (
        <p className="m-0 mb-2 text-[12px]" style={{ color: 'var(--ssz-text-muted)' }}>
          {t('sentenceSchema.skippedEarlier')}
        </p>
      )}

      {/* The sentence to rewrite. A prompt and only a prompt: nothing is derived from it,
          and the sentence the learner is building is not shown until it is closed. */}
      {row.source !== '' && (
        <div
          className="mb-3 rounded-lg border px-3 py-2"
          style={{
            background: 'var(--ssz-bg-subtle)',
            borderColor: 'var(--ssz-border-default)',
          }}
        >
          <span className="text-[11.5px] font-semibold" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.sourceLabel')}
          </span>
          <p
            className="m-0 text-[15px]"
            style={{ fontFamily: READING, color: 'var(--ssz-text-primary)' }}
          >
            {row.source}
          </p>
        </div>
      )}

      <SchemaBoard
        fields={row.fields}
        placement={placement}
        textOf={textOf}
        layout={fitsAsColumns(width, row.fields.length) ? 'cols' : 'rows'}
        labels={settings.labels}
        hints={settings.hints}
        counts={row.counts}
        marks={marks}
        selectedField={armedField}
        onFieldPress={pressField}
        onRemove={take}
        onDropItem={place}
        readOnly={locked}
        accent={accent}
      />

      {/* The bank goes away once the sentence is closed: there is nothing left to place,
          and leaving it invites input the board no longer takes. */}
      {!locked && (
        <div className="mt-3">
          <WordBank
            items={row.bank}
            used={used}
            selected={armedItem}
            onPress={pressItem}
            interactive={!locked}
            accent={accent}
          />
        </div>
      )}

      <div aria-live="polite" className="mt-3">
        {banner !== null && (
          <div
            className="flex items-start gap-2 rounded-md px-3 py-2.5"
            style={{
              background: solved
                ? 'var(--ssz-feedback-ok-bg)'
                : revealed
                  ? 'var(--ssz-color-primary-50)'
                  : 'var(--ssz-feedback-no-bg)',
              color: solved
                ? 'var(--ssz-color-success-700)'
                : revealed
                  ? 'var(--ssz-color-primary-700)'
                  : 'var(--ssz-color-error-700)',
            }}
          >
            {solved ? (
              <CheckCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : revealed ? (
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[13.5px]">{bannerText(banner, t)}</span>
              {/* The rule, repeated under the note from the second attempt on. */}
              {banner.hint !== '' && (
                <span className="text-[12.5px] opacity-85">{banner.hint}</span>
              )}
              {/* The sentence itself, once it is no longer the answer to anything. */}
              {phase === 'closed' && result?.text !== null && result?.text !== undefined && (
                <span className="text-[13.5px] font-semibold" style={{ fontFamily: READING }}>
                  {result.text}
                </span>
              )}
            </span>
          </div>
        )}
        {error !== null && (
          <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--ssz-feedback-no-fg)' }}>
            {error}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {phase === 'placing' && (
          <button
            type="button"
            onClick={onCheck}
            disabled={!interactive || sending || placedChunks === 0}
            className="rounded-lg px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent }}
          >
            {t('sentenceSchema.check', { placed: placedChunks, total: row.bank.length })}
          </button>
        )}
        {phase === 'checked' && (
          <button
            type="button"
            onClick={onRetry}
            disabled={!interactive}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t('sentenceSchema.fix', { count: result?.wrong ?? 0 })}
          </button>
        )}
        {phase === 'closed' && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg px-4 py-2 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent }}
          >
            {(lastSentence ?? index + 1 >= total) ? t('finish') : t('sentenceSchema.nextSentence')}
          </button>
        )}
        {phase !== 'closed' && onSkip !== undefined && (
          <button
            type="button"
            onClick={onSkip}
            disabled={!interactive || sending}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-muted)' }}
          >
            <SkipForward size={14} aria-hidden="true" />
            {t('sentenceSchema.skip')}
          </button>
        )}
        {phase !== 'closed' && (
          <button
            type="button"
            onClick={onReveal}
            disabled={!interactive || sending}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-muted)' }}
          >
            <Eye size={14} aria-hidden="true" />
            {t('sentenceSchema.reveal')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The note under the board, in the learner's language.
 *
 * The author's own words travel as text and are shown as written. `default` is a code
 * instead — the handoff writes those defaults as English prose, and this platform renders
 * student copy in four languages, so what crosses the wire is which default, not its
 * wording (plan 52 §5).
 */
function bannerText(
  banner: Feedback,
  t: ReturnType<typeof useTranslations<'ExerciseRunner'>>,
): string {
  if (banner.source !== 'default') return banner.text;
  return banner.code === 'order'
    ? t('sentenceSchema.wrongOrder')
    : t('sentenceSchema.notInSentence');
}
