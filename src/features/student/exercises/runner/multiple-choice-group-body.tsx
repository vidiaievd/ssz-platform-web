'use client';

import { Fragment } from 'react';
import { ArrowRight, BookOpen, Check, CircleAlert, Info, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import type { StudentProjection } from '@/lib/shared-kernel/multiple-choice-group';
import type {
  MultipleChoiceGroupItemResult,
  MultipleChoiceGroupSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import { Instr } from './instr';

/**
 * Where the runner is — BEHAVIOR §6, the state machine.
 *
 * `answering → checked → (retry | reveal) → closed → done`, with `closed` folded into
 * `checked` rather than given a phase of its own: it is not a decision this component
 * makes. The server says whether the table is closed and refuses a further check on one
 * that is, so `closed` is a field on the verdict here, exactly as it is on the wire
 * (plan 54 §3.3).
 */
export type MultipleChoiceGroupPhase = 'answering' | 'checked' | 'done';

/** The five states of an answer cell — README "Cell visual states". */
type CellState = 'default' | 'sel' | 'ok' | 'bad' | 'key';

/** The per-row result icon: right, wrong, or left unanswered. */
type RowMark = 'ok' | 'bad' | 'todo';

/**
 * Where the table stops fitting and becomes cards.
 *
 * Measured on this component's own box, not the window (`useContainerWidth`): the
 * builder preview is a phone frame on a desktop screen, and a body that asked the window
 * how wide it was could not be embedded in one.
 */
const TABLE_AT = 640;
/** Where the passage can sit beside the table rather than above it (R25/R26). */
const SPLIT_AT = 900;

const READING = 'var(--ssz-font-reading)';

const CELL_STYLE: Record<CellState, { border: string; bg: string; fg: string; dashed?: true }> = {
  default: {
    border: 'var(--ssz-border-strong)',
    bg: 'var(--ssz-bg-surface)',
    fg: 'var(--ssz-text-primary)',
  },
  sel: {
    border: 'var(--ssz-color-primary-500)',
    bg: 'var(--ssz-color-primary-500)',
    fg: 'var(--ssz-text-inverse)',
  },
  ok: {
    border: 'var(--ssz-color-success-500)',
    bg: 'var(--ssz-color-success-500)',
    fg: 'var(--ssz-text-inverse)',
  },
  bad: {
    border: 'var(--ssz-color-error-500)',
    bg: 'var(--ssz-color-error-500)',
    fg: 'var(--ssz-text-inverse)',
  },
  // The key, shown beside a wrong pick once the table is closed. Dashed and hollow
  // rather than filled: it is the answer being shown, not the answer being chosen.
  key: {
    border: 'var(--ssz-color-success-500)',
    bg: 'var(--ssz-bg-surface)',
    fg: 'var(--ssz-color-success-700)',
    dashed: true,
  },
};

const ROW_TINT: Record<RowMark, string> = {
  ok: 'var(--ssz-color-success-50)',
  bad: 'var(--ssz-color-error-50)',
  todo: 'transparent',
};

export interface MultipleChoiceGroupBodyProps {
  /** The table as the server projected it — never the stored document (it holds the key). */
  projection: StudentProjection;
  /** `rowId → columnId`. A row not in here is unanswered. */
  answers: Record<string, string>;
  onPick: (rowId: string, columnId: string) => void;
  phase: MultipleChoiceGroupPhase;
  /**
   * The last check, as the server reported it. Nothing here computes a verdict and
   * nothing fills in its optional fields: `keyColumnId` arrives only once the table is
   * closed, and a row with no `why` and no `quote` renders no explanation block at all,
   * whatever `showWhy` was set to (IMPLEMENTATION.md test checklist).
   */
  verdict: MultipleChoiceGroupSubmitDetails | null;
  /**
   * Rows the server has frozen under `lockCorrect`, cumulative.
   *
   * A prop of its own rather than a field read off `verdict`, because it outlives the
   * verdict: a retry drops the marks and keeps the freeze. The same shape of mistake that
   * made `multiple_choice`'s 50/50 vanish on «Prøv igjen» (plan 53 phase 4, finding 1).
   */
  locked?: string[];
  /** True while a check is in flight; the button says so and everything stays disabled. */
  sending?: boolean;
  /** What went wrong handing the table in, in the learner's language. */
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input (R6). */
  interactive?: boolean;
  /**
   * Whether the table draws its own progress bar. False where something outside it
   * already draws one — the practice stack counts tasks of the section. The `N/M svart`
   * counter stays either way, and both are ignored when the author turned progress off.
   */
  showProgressBar?: boolean;
  onCheck: () => void;
  /** «Prøv de feile igjen» — another check of the same table, on the next attempt. */
  onRetry: () => void;
  /** «Vis fasit» — closes the table with the score it already had. */
  onReveal: () => void;
  /** «Fullfør» — the closed table is read; show the done screen. */
  onFinish: () => void;
  /** «Gjør på nytt» — a fresh attempt. Absent where one cannot be had. */
  onRestart?: () => void;
  accent: string;
}

/**
 * The student's side of `multiple_choice_group`: a table of statements sharing one set of
 * answer columns, answered and checked as one block.
 *
 * It renders the table and it owns nothing about the outcome. Which column is right, how
 * many checks are left, which rows are frozen and what order the statements are in all
 * came from the server, because the key never reaches the browser (plan 54 §3.2, §3.5).
 * There is no branch in this file that could mark a cell right before a check, and none
 * that could reveal the key early — there is nothing here that knows it.
 *
 * **One component for the table and the cards.** They are one state machine seen at two
 * widths, and IMPLEMENTATION.md asks for exactly that: a second implementation is how a
 * phone starts behaving differently from a desktop on the same exercise.
 *
 * **`Neste oppgave` is not built.** The handoff's completion card offers it, but
 * navigation belongs to the player: these exercises sit in a stack on the practice page,
 * and a card that moved the learner on would be moving them somewhere the page did not
 * agree to. `Gjør på nytt` is built — it is about this attempt (plan 54 §5, precedent
 * plan 53 §5).
 */
export function MultipleChoiceGroupBody({
  projection,
  answers,
  onPick,
  phase,
  verdict,
  locked = [],
  sending = false,
  error = null,
  interactive = true,
  showProgressBar = true,
  onCheck,
  onRetry,
  onReveal,
  onFinish,
  onRestart,
  accent,
}: MultipleChoiceGroupBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const [root, width] = useContainerWidth();

  const s = projection.settings;
  const { rows, columns } = projection;
  const total = rows.length;

  const checked = phase === 'checked' && verdict !== null;
  const closed = checked && verdict.closed;
  const outcomes = new Map<string, MultipleChoiceGroupItemResult>(
    (verdict?.items ?? []).map((item) => [item.itemId, item]),
  );

  const answeredN = rows.filter((row) => answers[row.id] !== undefined).length;
  const remaining = total - answeredN;

  if (total === 0) {
    return (
      <div
        ref={root}
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <p className="text-[14px] font-semibold text-(--ssz-text-primary)">
          {t('multipleChoiceGroup.empty.title')}
        </p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">
          {t('multipleChoiceGroup.empty.body')}
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    const score = verdict?.passedItems ?? 0;
    return (
      <div
        ref={root}
        className="flex flex-col items-center gap-2.5 px-6 py-10 text-center"
        role="status"
        style={{ color: 'var(--ssz-color-success-700)' }}
      >
        <Check size={26} aria-hidden="true" />
        <h4 className="m-0 text-[17px] font-bold text-(--ssz-text-primary)">
          {t('multipleChoiceGroup.done.title')}
        </h4>
        <p className="m-0 text-[13.5px] text-(--ssz-text-secondary)">
          {t('multipleChoiceGroup.done.score', { score, total: verdict?.totalItems ?? total })}
        </p>
        {/* A `submit` that could not be confirmed — the table may or may not be in. Said
            here rather than swallowed, because the learner is the one who can try again. */}
        {error !== null && (
          <p className="text-[12.5px]" style={{ color: 'var(--ssz-feedback-no-fg)' }}>
            {error}
          </p>
        )}
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-secondary)' }}
          >
            <RotateCcw size={13} aria-hidden="true" />
            {t('multipleChoiceGroup.done.again')}
          </button>
        )}
      </div>
    );
  }

  const asTable = width >= TABLE_AT && s.layout !== 'cards';
  // `link` draws nothing at all, label included: the spec's «Til teksten» is a place to
  // go, and where it goes is still Q5 — a heading naming a lesson with no way to reach it
  // is worse than no heading. Phase 3 wrote every seeded table as `inline` for that reason.
  const passage =
    s.showText && projection.source.mode === 'inline' ? projection.source.text : undefined;
  const split = width >= SPLIT_AT && passage !== undefined;

  /**
   * What this cell looks like right now.
   *
   * `key` is reachable only from the server's `keyColumnId`, which arrives only once the
   * table is closed and only when the author left the key visible. While a retry is still
   * available the right column is not on this screen to be drawn.
   */
  function cellState(rowId: string, columnId: string): CellState {
    const picked = answers[rowId];
    const outcome = outcomes.get(rowId);

    if (checked && outcome !== undefined) {
      if (picked === columnId) return outcome.correct ? 'ok' : 'bad';
      if (outcome.keyColumnId === columnId) return 'key';
      return 'default';
    }
    return picked === columnId ? 'sel' : 'default';
  }

  function rowMark(rowId: string): RowMark | null {
    const outcome = outcomes.get(rowId);
    if (!checked || outcome === undefined) return null;
    if (outcome.correct) return 'ok';
    return outcome.submitted === null ? 'todo' : 'bad';
  }

  /**
   * A frozen row stays frozen for the rest of the exercise, and a checked table takes no
   * input until the learner chooses to try again — R10, and the reason is the same either
   * way: editing a table that has been judged is a judgement being edited.
   */
  function rowDisabled(rowId: string): boolean {
    return !interactive || sending || phase !== 'answering' || locked.includes(rowId);
  }

  /** The explanation under a row, or nothing at all when the server sent neither field. */
  function explanationOf(rowId: string): MultipleChoiceGroupItemResult | null {
    const outcome = outcomes.get(rowId);
    if (!checked || outcome === undefined) return null;
    const hasWhy = (outcome.why ?? '').trim() !== '';
    const hasQuote = (outcome.quote ?? '').trim() !== '';
    return hasWhy || hasQuote ? outcome : null;
  }

  const cell = (row: { id: string; text: string }, column: { id: string; label: string }) => {
    const state = cellState(row.id, column.id);
    const style = CELL_STYLE[state];
    const disabled = rowDisabled(row.id);

    return (
      <button
        type="button"
        role="radio"
        aria-checked={answers[row.id] === column.id}
        aria-label={`${row.text} — ${column.label}`}
        disabled={disabled}
        onClick={() => onPick(row.id, column.id)}
        className="grid h-6 w-6 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) disabled:cursor-default"
        style={{
          border: `${state === 'default' ? 1.5 : 2}px ${style.dashed ? 'dashed' : 'solid'} ${style.border}`,
          background: style.bg,
          color: style.fg,
        }}
      >
        {state === 'bad' && <X size={13} aria-hidden="true" />}
        {(state === 'ok' || state === 'key' || state === 'sel') && (
          <Check size={13} aria-hidden="true" />
        )}
      </button>
    );
  };

  const explanation = (outcome: MultipleChoiceGroupItemResult) => (
    <div className="flex gap-2 text-[13px] leading-relaxed text-(--ssz-text-secondary)">
      <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-(--ssz-text-muted)" />
      <div>
        {outcome.why}
        {(outcome.quote ?? '').trim() !== '' && (
          <q className="mt-1 block italic" style={{ fontFamily: READING }}>
            «{outcome.quote}»
          </q>
        )}
      </div>
    </div>
  );

  return (
    <div ref={root}>
      {s.progress && (
        <div className="mb-3 flex items-center gap-3">
          {showProgressBar && (
            <div
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--ssz-bg-muted)' }}
            >
              <i
                className="block h-full transition-[width] duration-500"
                style={{ width: `${(answeredN / total) * 100}%`, background: accent }}
              />
            </div>
          )}
          <span
            className={`text-[12px] font-semibold tabular-nums text-(--ssz-text-muted) ${
              showProgressBar ? 'shrink-0' : 'ml-auto'
            }`}
          >
            {t('multipleChoiceGroup.answered', { n: answeredN, total })}
          </span>
        </div>
      )}

      {projection.instruction.trim() !== '' && <Instr>{projection.instruction}</Instr>}

      <div
        className={split ? 'grid gap-5' : 'flex flex-col gap-4'}
        style={split ? { gridTemplateColumns: '0.85fr 1fr' } : undefined}
      >
        {passage !== undefined && (
          <div>
            {projection.source.label.trim() !== '' && (
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-(--ssz-text-muted)">
                <BookOpen size={13} aria-hidden="true" />
                {projection.source.label}
              </div>
            )}
            {/* Below the split the passage stacks above the table and gets its own
                scroll, so a long text does not push the statements off the screen (R26). */}
            <div
              className="overflow-y-auto px-3.5 py-3 whitespace-pre-wrap"
              style={{
                borderLeft: '2px solid var(--ssz-border-strong)',
                background: 'var(--ssz-bg-subtle)',
                borderRadius: '0 10px 10px 0',
                fontFamily: READING,
                fontSize: 14.5,
                lineHeight: 1.75,
                color: 'var(--ssz-text-secondary)',
                maxHeight: split ? undefined : 210,
              }}
            >
              {passage}
            </div>
          </div>
        )}

        <div className="min-w-0">
          {checked && (
            <Summary
              verdict={verdict}
              closed={closed}
              passThreshold={s.passThreshold}
              accent={accent}
            />
          )}

          {asTable ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="pb-2 text-left text-[12px] font-semibold text-(--ssz-text-muted)"
                  >
                    {t('multipleChoiceGroup.statement')}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className="w-[104px] pb-2 text-center text-[12px] font-semibold text-(--ssz-text-muted)"
                    >
                      {column.label}
                    </th>
                  ))}
                  {checked && (
                    <th scope="col" className="w-8 pb-2">
                      <span className="sr-only">{t('multipleChoiceGroup.result')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const mark = rowMark(row.id);
                  const outcome = explanationOf(row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr style={{ background: mark === null ? undefined : ROW_TINT[mark] }}>
                        <th
                          scope="row"
                          className="border-t border-(--ssz-border-default) py-2.5 pr-3 text-left font-normal"
                          style={{ fontFamily: READING, fontSize: 15, lineHeight: 1.5 }}
                        >
                          {s.numbering && (
                            <span
                              aria-hidden="true"
                              className="mr-2 text-[12px] text-(--ssz-text-muted)"
                              style={{ fontFamily: 'var(--ssz-font-mono)' }}
                            >
                              {i + 1}.
                            </span>
                          )}
                          {row.text}
                        </th>
                        {columns.map((column) => (
                          <td
                            key={column.id}
                            className="border-t border-(--ssz-border-default) py-2.5 text-center align-middle"
                          >
                            <span className="inline-grid place-items-center">
                              {cell(row, column)}
                            </span>
                          </td>
                        ))}
                        {checked && (
                          <td className="border-t border-(--ssz-border-default) py-2.5 text-center align-middle">
                            <RowIcon mark={mark} />
                          </td>
                        )}
                      </tr>
                      {/* A full-width row directly under its statement (R20) — and only
                          when the server sent something to put in it. */}
                      {outcome !== null && (
                        <tr style={{ background: mark === null ? undefined : ROW_TINT[mark] }}>
                          <td
                            colSpan={columns.length + (checked ? 2 : 1)}
                            className="pb-3 pr-3 pl-1"
                          >
                            {explanation(outcome)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rows.map((row, i) => {
                const mark = rowMark(row.id);
                const outcome = explanationOf(row.id);
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border px-3.5 py-3"
                    style={{
                      borderColor:
                        mark === 'ok'
                          ? 'var(--ssz-color-success-500)'
                          : mark === 'bad'
                            ? 'var(--ssz-color-error-500)'
                            : 'var(--ssz-border-default)',
                      background: mark === null ? 'var(--ssz-bg-surface)' : ROW_TINT[mark],
                    }}
                  >
                    <div className="mb-2.5 flex items-start gap-2">
                      {s.numbering && (
                        <span
                          aria-hidden="true"
                          className="mt-0.5 text-[12px] text-(--ssz-text-muted)"
                          style={{ fontFamily: 'var(--ssz-font-mono)' }}
                        >
                          {i + 1}.
                        </span>
                      )}
                      <div
                        className="min-w-0 flex-1"
                        style={{ fontFamily: READING, fontSize: 15.5, lineHeight: 1.5 }}
                      >
                        {row.text}
                      </div>
                      {checked && <RowIcon mark={mark} />}
                    </div>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={row.text}>
                      {columns.map((column) => {
                        const state = cellState(row.id, column.id);
                        const style = CELL_STYLE[state];
                        const disabled = rowDisabled(row.id);
                        return (
                          <button
                            key={column.id}
                            type="button"
                            role="radio"
                            aria-checked={answers[row.id] === column.id}
                            disabled={disabled}
                            onClick={() => onPick(row.id, column.id)}
                            className="inline-flex min-h-12 flex-1 basis-[128px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) disabled:cursor-default"
                            style={{
                              border: `1.5px ${style.dashed ? 'dashed' : 'solid'} ${
                                state === 'default' ? 'var(--ssz-border-default)' : style.border
                              }`,
                              background: state === 'default' ? 'var(--ssz-bg-surface)' : style.bg,
                              color: state === 'default' ? 'var(--ssz-text-primary)' : style.fg,
                            }}
                          >
                            {state === 'bad' && <X size={14} aria-hidden="true" />}
                            {(state === 'ok' || state === 'key') && (
                              <Check size={14} aria-hidden="true" />
                            )}
                            {column.label}
                          </button>
                        );
                      })}
                    </div>
                    {outcome !== null && <div className="mt-2.5">{explanation(outcome)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!checked && (
          <>
            <button
              type="button"
              disabled={!interactive || sending || remaining > 0}
              onClick={onCheck}
              className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ background: accent }}
            >
              {sending ? t('multipleChoiceGroup.checking') : t('multipleChoiceGroup.check')}
            </button>
            {remaining > 0 && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-(--ssz-text-muted)">
                <CircleAlert size={13} aria-hidden="true" />
                {t('multipleChoiceGroup.remaining', { n: remaining })}
              </p>
            )}
          </>
        )}

        {checked && !closed && (
          <>
            <button
              type="button"
              disabled={!interactive || sending}
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ background: accent }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('multipleChoiceGroup.retryWrong')}
            </button>
            <button
              type="button"
              disabled={!interactive || sending}
              onClick={onReveal}
              className="rounded-lg border px-4 py-2 text-[13px] font-semibold disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{
                borderColor: 'var(--ssz-border-default)',
                color: 'var(--ssz-text-secondary)',
              }}
            >
              {t('multipleChoiceGroup.showKey')}
            </button>
          </>
        )}

        {closed && (
          <button
            type="button"
            onClick={onFinish}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent }}
          >
            {t('multipleChoiceGroup.finish')}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}

        {checked && (
          <p className="ml-auto text-[12.5px] text-(--ssz-text-muted)">
            {t('multipleChoiceGroup.attempt', { n: verdict.attempt })}
          </p>
        )}
      </div>

      {error !== null && (
        <p
          className="mt-2 flex items-start gap-1.5 text-[12.5px]"
          style={{ color: 'var(--ssz-feedback-no-fg)' }}
        >
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** ✓ / × / ⚠ per row, so colour is never the only signal (README, accessibility). */
function RowIcon({ mark }: { mark: RowMark | null }) {
  if (mark === null) return null;
  if (mark === 'ok') {
    return <Check size={15} aria-hidden="true" style={{ color: 'var(--ssz-color-success-700)' }} />;
  }
  if (mark === 'bad') {
    return <X size={15} aria-hidden="true" style={{ color: 'var(--ssz-color-error-700)' }} />;
  }
  return <CircleAlert size={15} aria-hidden="true" style={{ color: 'var(--ssz-text-muted)' }} />;
}

/**
 * The score card above the table — README "Feedback".
 *
 * The percentage is arithmetic over two numbers the server sent, not a judgement: the
 * engine counted the correct rows and this divides them by the total. `>=`, never `>`,
 * because that is what the kernel compares with and the handoff asks for it by name.
 */
function Summary({
  verdict,
  closed,
  passThreshold,
  accent,
}: {
  verdict: MultipleChoiceGroupSubmitDetails;
  closed: boolean;
  passThreshold: number;
  accent: string;
}) {
  const t = useTranslations('ExerciseRunner');
  const { passedItems, totalItems } = verdict;
  const pct = totalItems === 0 ? 0 : Math.round((passedItems / totalItems) * 100);
  const passed = pct >= passThreshold;
  const wrong = totalItems - passedItems;

  const tone = !closed
    ? { bg: 'var(--ssz-bg-subtle)', fg: 'var(--ssz-text-secondary)' }
    : passed
      ? { bg: 'var(--ssz-color-success-50)', fg: 'var(--ssz-color-success-700)' }
      : { bg: 'var(--ssz-color-warning-50)', fg: 'var(--ssz-color-warning-700)' };

  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-3 rounded-xl px-3.5 py-2.5"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span
        className="text-[19px] font-bold tabular-nums"
        style={{ color: closed ? tone.fg : accent }}
      >
        {passedItems}
        <i className="text-[13px] font-semibold not-italic opacity-70">/{totalItems}</i>
      </span>
      <span className="text-[13px] leading-snug">
        <b className="block font-semibold">
          {closed
            ? passed
              ? t('multipleChoiceGroup.passed')
              : t('multipleChoiceGroup.notPassed')
            : wrong > 0
              ? t('multipleChoiceGroup.wrongCount', { n: wrong })
              : t('multipleChoiceGroup.allRight')}
        </b>
        {closed
          ? t('multipleChoiceGroup.scoreLine', { pct, threshold: passThreshold })
          : t('multipleChoiceGroup.lookAgain')}
      </span>
    </div>
  );
}
