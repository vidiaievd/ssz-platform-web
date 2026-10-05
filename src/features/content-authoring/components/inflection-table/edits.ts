import {
  addManualRow as addManualRowTo,
  addRow,
  bulkFirstGiven as bulkFirstGivenOf,
  bulkOpenAll as bulkOpenAllOf,
  fromDictionary,
  packOf,
  paradigmOf,
  pickParadigm as pickParadigmOf,
  removeRow as removeRowFrom,
  setCellMode as setCellModeOf,
  setCellValue as setCellValueOf,
  setInstruction as setInstructionOf,
  setLemma as setLemmaOf,
  slotsInPlay,
  toggleSlot as toggleSlotOf,
  type CellMode,
  type DictionaryEntry,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 69 §4.1).
 *
 * The cascades — a paradigm switch clearing the rows, slots kept in the pack's order, the ten-row
 * ceiling, no second row for the same dictionary entry — are the kernel's and are tested there.
 * What is here is only the shape: the builder holds a document that carries more than the
 * kernel's (`updatedAt`), and the kernel returns the plain content. `keep` lays the result over
 * the document so the extras survive.
 */
type Doc = InflectionTableContent;

/** The document as the builder holds it: the kernel's content plus the row's token. */
export interface InflectionTableDocument extends InflectionTableContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
}

function keep<T extends Doc>(ex: T, next: Doc): T {
  return { ...ex, ...next };
}

// ── Step 1 ──────────────────────────────────────────────────────────────────

export function setInstruction<T extends Doc>(ex: T, instruction: string): T {
  return keep(ex, setInstructionOf(ex, instruction));
}

/** Another paradigm: all of its slots in play and no rows. The builder asks first. */
export function pickParadigm<T extends Doc>(ex: T, paradigmId: string): T {
  return keep(ex, pickParadigmOf(ex, paradigmId));
}

export function toggleSlot<T extends Doc>(ex: T, slotId: string): T {
  return keep(ex, toggleSlotOf(ex, slotId));
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

/** A row from a dictionary entry, with its forms as suggestions. Refused at the ceiling. */
export function addFromDictionary<T extends Doc>(ex: T, entry: DictionaryEntry): T {
  const pack = packOf(ex);
  const paradigm = paradigmOf(ex);
  if (!pack || !paradigm) return ex;
  return keep(ex, addRow(ex, fromDictionary(entry, pack, paradigm, slotsInPlay(ex))));
}

export function addManualRow<T extends Doc>(ex: T): T {
  return keep(ex, addManualRowTo(ex));
}

export function removeRow<T extends Doc>(ex: T, rowId: string): T {
  return keep(ex, removeRowFrom(ex, rowId));
}

export function setLemma<T extends Doc>(ex: T, rowId: string, lemma: string): T {
  return keep(ex, setLemmaOf(ex, rowId, lemma));
}

export function setCellMode<T extends Doc>(
  ex: T,
  rowId: string,
  slotId: string,
  mode: CellMode,
): T {
  return keep(ex, setCellModeOf(ex, rowId, slotId, mode));
}

export function setCellValue<T extends Doc>(
  ex: T,
  rowId: string,
  slotId: string,
  value: string,
): T {
  return keep(ex, setCellValueOf(ex, rowId, slotId, value));
}

export function bulkFirstGiven<T extends Doc>(ex: T): T {
  return keep(ex, bulkFirstGivenOf(ex));
}

export function bulkOpenAll<T extends Doc>(ex: T): T {
  return keep(ex, bulkOpenAllOf(ex));
}
