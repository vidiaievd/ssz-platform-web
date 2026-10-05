'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { CircleAlert, RotateCcw, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import {
  AudioLockNote,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';
import type {
  ProjectedRow,
  ProjectedSlot,
  StudentProjection,
} from '@/lib/shared-kernel/inflection-table';
import { cellKey } from '@/lib/shared-kernel/inflection-table';
import type {
  InflectionTableItemResult,
  InflectionTableSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import { Instr } from './instr';

/**
 * Where the runner is. `checked` is the screen after a check; a retry returns to
 * `answering` with the wrong cells cleared. There is no `done`: navigation belongs to the
 * player (plan 69, deviation 12).
 */
export type InflectionTablePhase = 'answering' | 'checked';

export type InflectionTableLayout = 'phone' | 'desktop';

/** `rowId:slotId → the form typed or placed`. An empty cell is simply absent. */
export type InflectionTableValues = Record<string, string>;

/** How a cell is drawn — the prototype's `data-s`. */
type CellState = 'empty' | 'filled' | 'ok' | 'bad';

/** Where the grid gives way to row cards: a lemma column and four slots of 92px and up. */
const GRID_AT = 640;
const TAP_MIN = 44;
const READING = 'var(--ssz-font-reading)';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface InflectionTableBodyProps {
  /** The table as the server dealt it: rows and bank in their dealt order, and no key. */
  projection: StudentProjection;
  /** The exercise's title, from the lesson item — the projection carries none. */
  title?: string;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  /** What stands in every asked cell, locked and unchecked alike. */
  values: InflectionTableValues;
  /** Type or place a form; `null` empties the cell. */
  onValueChange: (key: string, value: string | null) => void;
  phase: InflectionTablePhase;
  /** What the last check said. `null` before the first one and again after a retry. */
  verdict: InflectionTableSubmitDetails | null;
  /**
   * Cells the server froze, cumulative. A prop of its own rather than a field of `verdict`,
   * because it outlives it: a retry drops the marks and keeps the freeze (plan 54's lesson).
   */
  locked?: string[];
  /** The check the table is on, 1-based — one past the last when a retry has been made. */
  attempt: number;
  sending?: boolean;
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /** Forces a layout — the builder preview's phone/desktop switch, and tests (jsdom measures 0). */
  layout?: InflectionTableLayout;
  onCheck: () => void;
  onRetry: () => void;
  accent: string;
  /** The listening layer, mounted once by whoever owns the document (plan 56). */
  audio?: ExerciseAudioEngine;
  audioTranscript?: { transcript: string; translation: string } | null;
}

/**
 * `inflection_table`, as the learner plays it: one table, not a set of gaps (plan 69 §7.8).
 *
 * One component, two layouts, switched on its **own** width (`useContainerWidth`) unless a
 * `layout` is forced: a grid on a wide surface, one card per row on a narrow one (README:
 * «Phone layout is row-cards»). Typing mode draws a field per asked cell; bank mode draws a
 * slot per cell and a bank of forms to pick from.
 *
 * Controlled, and it owns nothing about the outcome. Which cell is right, which are frozen,
 * whether the table is closed and what the report says are the server's: nothing here knows
 * a key, so there is no branch that could mark a cell right before a check.
 */
export function InflectionTableBody({
  projection,
  title,
  instruction,
  values,
  onValueChange,
  phase,
  verdict,
  locked = [],
  attempt,
  sending = false,
  error = null,
  interactive = true,
  layout,
  onCheck,
  onRetry,
  accent,
  audio,
  audioTranscript = null,
}: InflectionTableBodyProps) {
  const t = useTranslations('ExerciseRunner.inflectionTable');
  const [root, width] = useContainerWidth();
  /** The bank form in hand, waiting for a cell. */
  const [held, setHeld] = useState<string | null>(null);

  const { rows, slots, settings } = projection;
  const bank = settings.input === 'bank';
  const desktop = (layout ?? (width >= GRID_AT ? 'desktop' : 'phone')) === 'desktop';

  const lockedSet = new Set(locked);
  const outcomes = new Map<string, InflectionTableItemResult>(
    (verdict?.items ?? []).map((item) => [item.itemId, item]),
  );
  const audioOn = audio !== undefined && audio.audio.enabled;
  const audioLocked = audioOn && audio.gated;
  const canEdit = interactive && phase === 'answering' && !sending && !audioLocked;

  const askedKeys = rows.flatMap((row) =>
    slots.filter((s) => row.cells[s.id]?.mode === 'ask').map((s) => cellKey(row.id, s.id)),
  );
  const total = askedKeys.length;
  const filled = askedKeys.filter((key) => (values[key] ?? '').trim() !== '').length;
  // Frozen cells are filled and need no check; the button is for what has changed.
  const checkable = askedKeys.some(
    (key) => !lockedSet.has(key) && (values[key] ?? '').trim() !== '',
  );
  const closed = verdict?.closed === true;
  const wrong = verdict === null ? 0 : verdict.items.filter((item) => !item.correct).length;
  const slotLabel = new Map(slots.map((s) => [s.id, s.label]));
  const lemmaOf = new Map(rows.map((r) => [r.id, r.lemma]));

  if (rows.length === 0 || total === 0) {
    return (
      <div
        ref={root}
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <p className="text-[14px] font-semibold text-(--ssz-text-primary)">{t('empty.title')}</p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">{t('empty.body')}</p>
      </div>
    );
  }

  const stateOf = (key: string): CellState => {
    const outcome = outcomes.get(key);
    if (lockedSet.has(key) || outcome?.correct === true) return 'ok';
    if (outcome !== undefined) return 'bad';
    return (values[key] ?? '').trim() !== '' ? 'filled' : 'empty';
  };

  /** Bank mode: a form in hand goes into the cell; with nothing in hand a filled cell empties. */
  function tapCell(key: string) {
    if (!canEdit || lockedSet.has(key)) return;
    if (held !== null) {
      onValueChange(key, held);
      setHeld(null);
    } else if ((values[key] ?? '') !== '') {
      onValueChange(key, null);
    }
  }

  const renderCell = (row: ProjectedRow, slot: ProjectedSlot): ReactNode => {
    const cell = row.cells[slot.id];
    if (cell === undefined) return null;
    if (cell.mode === 'prefill') {
      return (
        <span
          className="inline-block px-1 py-[7px] text-base text-(--ssz-text-muted)"
          style={{ fontFamily: READING }}
          lang={projection.language || undefined}
        >
          {cell.value}
        </span>
      );
    }

    const key = cellKey(row.id, slot.id);
    const state = stateOf(key);
    const value = values[key] ?? '';
    const outcome = outcomes.get(key);
    const placeholder = cell.hint === undefined ? '' : `${cell.hint}…`;
    const name = t('cellFor', { lemma: row.lemma, slot: slot.label });
    // Right and wrong ride in the label and the strike-through as well as the colour (IT-X8).
    const label =
      state === 'ok'
        ? `${name}, ${t('cellRight')}`
        : state === 'bad'
          ? `${name}, ${t('cellWrong')}`
          : name;
    const frozen = lockedSet.has(key);
    const selected = bank && held !== null && value === '';

    return (
      <span className="inline-flex min-w-0 flex-col gap-0.5">
        {bank ? (
          <button
            type="button"
            onClick={() => tapCell(key)}
            disabled={!canEdit || frozen}
            aria-label={value === '' ? label : `${label}: ${value}`}
            data-s={state}
            className={`w-full text-left disabled:cursor-default ${FOCUS}`}
            style={{
              ...cellStyle(state),
              cursor: canEdit && !frozen ? 'pointer' : 'default',
              ...(selected ? { boxShadow: 'var(--ssz-focus-ring)' } : {}),
            }}
          >
            {value !== '' ? value : placeholder}
          </button>
        ) : (
          <input
            value={value}
            disabled={!canEdit || frozen}
            placeholder={placeholder}
            aria-label={label}
            data-s={state}
            onChange={(event) => onValueChange(key, event.target.value)}
            // Autocorrect would repair exactly what is being asked: the endings (IT-X7).
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            lang={projection.language || undefined}
            className={`w-full ${FOCUS}`}
            style={cellStyle(state)}
          />
        )}
        {outcome?.correctForm !== undefined && !outcome.correct && (
          <span
            className="pl-0.5 text-sm"
            style={{ fontFamily: READING, color: 'var(--ssz-color-success-700)' }}
          >
            {outcome.correctForm}
          </span>
        )}
      </span>
    );
  };

  const renderRowChip = (row: ProjectedRow): ReactNode => {
    if (!settings.rowVerdict || verdict === null) return null;
    const result = verdict.rows.find((r) => r.rowId === row.id);
    if (result === undefined) return null;
    const all = result.ok === result.asked;
    const tone = all
      ? ['success-50', 'success-700']
      : result.ok > 0
        ? ['warning-50', 'warning-700']
        : ['error-50', 'error-700'];
    return (
      <span
        className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{
          background: `var(--ssz-color-${tone[0]})`,
          color: `var(--ssz-color-${tone[1]})`,
        }}
      >
        {all ? t('rowAll') : t('rowPart', { ok: result.ok, n: result.asked })}
      </span>
    );
  };

  const showRowColumn = settings.rowVerdict && verdict !== null;
  const progress = verdict !== null ? verdict.correctNow : filled;

  const failures = verdict === null ? [] : verdict.items.filter((item) => !item.correct);

  return (
    <div ref={root} data-layout={desktop ? 'desktop' : 'phone'} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 shrink-0 text-[11px] text-(--ssz-text-muted)">
          {title !== undefined && title.trim() !== '' ? title : t('defaultTitle')}
        </span>
        <div
          role="progressbar"
          aria-label={t('progress')}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={progress}
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-bg-subtle)' }}
        >
          <i
            className="block h-full"
            style={{ width: `${(progress / total) * 100}%`, background: accent }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-(--ssz-text-muted)">
          {progress}/{total}
        </span>
      </div>

      <Instr>
        {instruction !== undefined && instruction !== ''
          ? instruction
          : projection.instruction !== ''
            ? projection.instruction
            : t('defaultInstruction')}
      </Instr>

      {audioOn && (
        <div>
          <ExerciseAudioPlayer eng={audio} interactive={interactive} />
          {audioLocked && <AudioLockNote />}
        </div>
      )}

      {desktop ? (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{projection.paradigm.lemmaLabel || t('rowHead')}</span>
                </th>
                {slots.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    className="whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-(--ssz-text-muted)"
                  >
                    {s.label}
                  </th>
                ))}
                {showRowColumn && (
                  <th scope="col">
                    <span className="sr-only">{t('rowHead')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="whitespace-nowrap border-t py-2 pl-0 pr-2.5 text-left font-normal"
                    style={{ borderColor: 'var(--ssz-border-default)' }}
                  >
                    <b
                      className="block text-base font-semibold"
                      style={{ fontFamily: READING }}
                      lang={projection.language || undefined}
                    >
                      {row.lemma}
                    </b>
                    <span className="text-[11px] text-(--ssz-text-muted)">{row.gloss}</span>
                  </th>
                  {slots.map((s) => (
                    <td
                      key={s.id}
                      className="border-t py-1.5 pl-0 pr-1.5 align-top"
                      style={{ borderColor: 'var(--ssz-border-default)' }}
                    >
                      {renderCell(row, s)}
                    </td>
                  ))}
                  {showRowColumn && (
                    <td
                      className="border-t py-1.5 text-right align-top"
                      style={{ borderColor: 'var(--ssz-border-default)' }}
                    >
                      {renderRowChip(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <section
              key={row.id}
              aria-label={row.lemma}
              className="flex flex-col gap-1.5 rounded-(--ssz-radius-md) border px-3 py-2.5"
              style={{
                borderColor: 'var(--ssz-border-default)',
                background: 'var(--ssz-bg-surface)',
              }}
            >
              <div className="flex items-baseline gap-[7px]">
                <b
                  className="text-lg font-semibold"
                  style={{ fontFamily: READING }}
                  lang={projection.language || undefined}
                >
                  {row.lemma}
                </b>
                <span className="text-[11px] text-(--ssz-text-muted)">{row.gloss}</span>
                <span className="flex-1" />
                {renderRowChip(row)}
              </div>
              {slots.map((s) =>
                row.cells[s.id] === undefined ? null : (
                  <div
                    key={s.id}
                    className="grid items-center gap-2.5"
                    style={{ gridTemplateColumns: '96px minmax(0, 1fr)' }}
                  >
                    <span className="text-[11px] uppercase tracking-wider text-(--ssz-text-muted)">
                      {s.label}
                    </span>
                    {renderCell(row, s)}
                  </div>
                ),
              )}
            </section>
          ))}
        </div>
      )}

      {/* Always mounted so the announcement is made when the verdict arrives, not when the
          region appears. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {verdict !== null && (
          <>
            <div
              className="flex items-baseline gap-2.5 rounded-(--ssz-radius-sm) px-3 py-2.5"
              style={{
                background: verdict.passed
                  ? 'var(--ssz-color-success-50)'
                  : 'var(--ssz-color-warning-50)',
                color: verdict.passed
                  ? 'var(--ssz-color-success-700)'
                  : 'var(--ssz-color-warning-700)',
              }}
            >
              <b className="text-lg">
                {t('score', { k: verdict.passedItems, n: verdict.totalItems })}
              </b>
              <span className="text-xs">
                {verdict.passed ? t('passed') : t('below', { pct: verdict.pct })}
              </span>
            </div>

            {failures.map((item) => (
              <FeedbackRow key={item.itemId} tone="bad" icon={<X size={15} aria-hidden="true" />}>
                <b style={{ fontFamily: READING }}>
                  {lemmaOf.get(item.rowId)} · {slotLabel.get(item.slotId)}
                </b>
                {item.value !== '' ? (
                  <>
                    {' — '}
                    {t('wrote')} <span style={{ fontFamily: READING }}>«{item.value}»</span>
                  </>
                ) : (
                  <> — {t('blank')}</>
                )}
                {item.near !== undefined && (
                  <span className="mt-[3px] block text-xs font-semibold">
                    {item.near === 'diacritic' ? t('nearDiacritic') : t('nearEnding')}
                  </span>
                )}
                {item.why !== undefined && (
                  <span className="mt-[3px] block text-sm text-(--ssz-text-secondary)">
                    {item.why}
                  </span>
                )}
              </FeedbackRow>
            ))}

            {wrong === 0 && (
              <FeedbackRow tone="ok" icon={<Check size={15} aria-hidden="true" />}>
                {t('allRight', { n: rows.length })}
              </FeedbackRow>
            )}
          </>
        )}
      </div>

      {bank && phase === 'answering' && (
        <div
          className="flex flex-col gap-2 border-t border-dashed pt-3"
          style={{ borderColor: 'var(--ssz-border-default)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--ssz-text-muted)">
            {t('bankLabel')}
          </span>
          <div className="flex flex-wrap gap-2">
            {(projection.bank ?? []).map((form, index) => {
              const used = Object.values(values).includes(form);
              const armed = held === form;
              return (
                <button
                  // The same form can be offered twice (a distractor equal to a key's twin).
                  key={`${form}-${index}`}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={armed}
                  data-used={used || undefined}
                  onClick={() => setHeld(armed ? null : form)}
                  className={`rounded-lg border px-3 py-2 text-base disabled:cursor-default ${FOCUS}`}
                  style={{
                    minHeight: TAP_MIN,
                    fontFamily: READING,
                    opacity: used ? 0.45 : 1,
                    background: armed ? 'var(--ssz-bg-subtle)' : 'var(--ssz-bg-surface)',
                    borderColor: armed ? accent : 'var(--ssz-border-default)',
                    borderWidth: armed ? 2 : 1,
                    color: 'var(--ssz-text-primary)',
                  }}
                >
                  {form}
                </button>
              );
            })}
          </div>
          <p role="status" className="sr-only">
            {held !== null ? t('bankSelected', { form: held }) : ''}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {phase === 'answering' ? (
          <button
            type="button"
            disabled={!interactive || sending || audioLocked || !checkable}
            onClick={onCheck}
            className={`rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`}
            style={{ minHeight: TAP_MIN, background: accent }}
          >
            {sending ? t('checking') : t('check')}
          </button>
        ) : (
          !closed &&
          wrong > 0 && (
            <button
              type="button"
              disabled={!interactive || sending}
              onClick={onRetry}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`}
              style={{ minHeight: TAP_MIN, background: accent }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('retryWrong', { n: verdict?.attempt ?? attempt, max: settings.attempts })}
            </button>
          )
        )}
      </div>

      {error !== null && (
        <p
          className="m-0 flex items-start gap-1.5 text-[12.5px]"
          style={{ color: 'var(--ssz-feedback-no-fg)' }}
        >
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
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

/** The prototype's `wb-fb` row: a tinted line with an icon, for a wrong cell or the all-right note. */
function FeedbackRow({
  tone,
  icon,
  children,
}: {
  tone: 'ok' | 'bad';
  icon: ReactNode;
  children: ReactNode;
}) {
  const colours =
    tone === 'ok'
      ? { bg: 'var(--ssz-feedback-ok-bg)', fg: 'var(--ssz-feedback-ok-fg)' }
      : { bg: 'var(--ssz-feedback-no-bg)', fg: 'var(--ssz-feedback-no-fg)' };
  return (
    <div
      className="flex items-start gap-2 rounded-(--ssz-radius-sm) px-3 py-2.5 text-sm"
      style={{ background: colours.bg, color: colours.fg }}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** `it-r-cell` and its four states (§7.8). A wrong cell is struck through, not only red. */
function cellStyle(state: CellState): CSSProperties {
  const base: CSSProperties = {
    minWidth: 92,
    minHeight: 40,
    padding: '7px 10px',
    border: '1px solid var(--ssz-border-strong)',
    borderBottomWidth: 2,
    borderRadius: 'var(--ssz-radius-sm)',
    background: 'var(--ssz-bg-surface)',
    fontFamily: READING,
    fontSize: 'var(--ssz-text-base)',
    color: 'var(--ssz-text-primary)',
    textAlign: 'left',
  };
  switch (state) {
    case 'empty':
      return { ...base, background: 'var(--ssz-bg-subtle)' };
    case 'filled':
      return {
        ...base,
        borderColor: 'var(--ssz-color-primary-400)',
        background: 'var(--ssz-color-primary-50)',
      };
    case 'ok':
      return {
        ...base,
        borderColor: 'var(--ssz-color-success-500)',
        background: 'var(--ssz-color-success-50)',
        color: 'var(--ssz-color-success-700)',
      };
    case 'bad':
      return {
        ...base,
        borderColor: 'var(--ssz-color-error-500)',
        background: 'var(--ssz-color-error-50)',
        color: 'var(--ssz-color-error-700)',
        textDecoration: 'line-through',
      };
  }
}
