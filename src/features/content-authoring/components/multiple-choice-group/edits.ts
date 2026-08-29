// Editing operations on a `multiple_choice_group` document, for the builder.
//
// Everything here is pure: document in, document out. Anything *derived* — what is wrong
// with the table, how the answers spread over the columns, what the student would be sent
// — belongs to `@/lib/shared-kernel/multiple-choice-group` and is never recomputed here.
// This file only rewrites what the author typed.
//
// The same division as `multiple-choice/edits.ts`, and for the same reason: the kernel is
// what the server reads too, so anything this file worked out for itself would be a second
// opinion about the same document.
//
// Four rules are deliberately *not* here, because they are rules of the model rather than
// conveniences of the editor, and the kernel already owns them:
//
//   * **one answer per row** — `setAnswer`, which also clears on a second click (S2.4);
//   * **a preset rebuilds the columns and remaps the answers by label** — `applyPreset`;
//   * **deleting a column nulls the answers pointing at it** — `removeColumn`;
//   * **a bulk paste replaces the empty rows** — `appendRows`.
//
// An editor that spelled any of them out again would be the second place they are written
// down, and the first to drift.

import {
  appendRows,
  applyPreset as applyColumnPreset,
  addColumn as addColumnToSet,
  newRow,
  parseBulk,
  removeColumn as removeColumnFromSet,
  setAnswer,
  type Column,
  type MultipleChoiceGroupContent,
  type Preset,
  type Row,
  type Settings,
  type Source,
} from '@/lib/shared-kernel/multiple-choice-group';

/**
 * The document as the builder holds it: the kernel's content plus the row's token.
 *
 * The envelope lives here rather than in the kernel because the kernel is shared with the
 * services, and `updatedAt` is a fact about a Prisma row — the shape plan 51 settled on
 * for `short_answer` and every builder since has repeated.
 */
export interface MultipleChoiceGroupDocument extends MultipleChoiceGroupContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
}

/** README "Answer columns": `Add column` is disabled at four. */
export const MAX_COLUMNS = 4;
/** A single column is not a choice. `Delete column` is disabled at two. */
export const MIN_COLUMNS = 2;
/** BEHAVIOR S2.7: the last statement row cannot be deleted. */
export const MIN_ROWS = 1;
/** BEHAVIOR S1.9: the short code is at most three characters. */
export const MAX_SHORT = 3;

// ── The exercise ────────────────────────────────────────────────────────────

export function setSource<T extends MultipleChoiceGroupContent>(ex: T, patch: Partial<Source>): T {
  return { ...ex, source: { ...ex.source, ...patch } };
}

export function setSettings<T extends MultipleChoiceGroupContent>(
  ex: T,
  patch: Partial<Settings>,
): T {
  return { ...ex, settings: { ...ex.settings, ...patch } };
}

// ── Columns ─────────────────────────────────────────────────────────────────

export type ColumnPatch = Partial<Pick<Column, 'label' | 'short'>>;

/**
 * Rename a column, or change its short code.
 *
 * The short code is not re-derived when the label changes. It is what a bulk paste
 * resolves `| R` against, so a code that moved under a rename would silently unanswer the
 * lines an author is in the middle of pasting — and BEHAVIOR S1.9 has it as a field of its
 * own precisely so it can be chosen rather than guessed.
 */
export function setColumn<T extends MultipleChoiceGroupContent>(
  ex: T,
  columnId: string,
  patch: ColumnPatch,
): T {
  return {
    ...ex,
    columns: ex.columns.map((c) =>
      c.id === columnId
        ? {
            ...c,
            ...patch,
            ...(patch.short === undefined ? {} : { short: patch.short.slice(0, MAX_SHORT) }),
          }
        : c,
    ),
  };
}

/** One more empty column, up to four — a blocker until it is named (S1.11). */
export function addColumn<T extends MultipleChoiceGroupContent>(ex: T): T {
  return addColumnToSet(ex as MultipleChoiceGroupContent) as T;
}

/** Drop a column, clearing the answers that pointed at it. Never below two (S1.10). */
export function removeColumn<T extends MultipleChoiceGroupContent>(ex: T, columnId: string): T {
  return removeColumnFromSet(ex as MultipleChoiceGroupContent, columnId) as T;
}

/** Rebuild the column set from a preset, carrying the answers across by label (S1.6). */
export function applyPreset<T extends MultipleChoiceGroupContent>(ex: T, preset: Preset): T {
  return applyColumnPreset(ex as MultipleChoiceGroupContent, preset) as T;
}

// ── Statements ──────────────────────────────────────────────────────────────

export type RowPatch = Partial<Pick<Row, 'text' | 'why' | 'quote'>>;

export function setRow<T extends MultipleChoiceGroupContent>(
  ex: T,
  rowId: string,
  patch: RowPatch,
): T {
  return { ...ex, rows: ex.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) };
}

/**
 * Mark which column this statement belongs in, or unmark it.
 *
 * A one-line delegation on purpose: "one answer per row" is a rule of the model, and the
 * clearing behaviour on a second click is BEHAVIOR S2.4 rather than a flourish of this
 * screen.
 */
export function markAnswer<T extends MultipleChoiceGroupContent>(
  ex: T,
  rowId: string,
  columnId: string,
): T {
  return { ...ex, rows: ex.rows.map((r) => (r.id === rowId ? setAnswer(r, columnId) : r)) };
}

/** One more empty statement at the end (S2.8). */
export function addRow<T extends MultipleChoiceGroupContent>(ex: T): T {
  return { ...ex, rows: [...ex.rows, newRow()] };
}

/**
 * Remove a statement — never the last one.
 *
 * The floor is enforced here as well as on the button: `rows: []` is a blocker of its own,
 * and a table an author emptied by clicking would be a document the gate then refuses for
 * a reason that reads as a bug. Adding a row back is one click; the deleted text is not.
 */
export function removeRow<T extends MultipleChoiceGroupContent>(ex: T, rowId: string): T {
  if (ex.rows.length <= MIN_ROWS) return ex;
  return { ...ex, rows: ex.rows.filter((r) => r.id !== rowId) };
}

/**
 * Append the statements of a bulk paste — `Statement | R`.
 *
 * The parse and the append are both the kernel's, and the append is the half worth
 * naming: a fresh document is four blank rows, so pasting six statements into it must
 * leave six and not ten (BEHAVIOR S2.15).
 */
export function applyBulkPaste<T extends MultipleChoiceGroupContent>(ex: T, text: string): T {
  return appendRows(ex as MultipleChoiceGroupContent, parseBulk(ex.columns, text)) as T;
}
