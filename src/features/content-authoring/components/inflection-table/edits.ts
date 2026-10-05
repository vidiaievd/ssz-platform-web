import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  addAccept as addAcceptTo,
  addManualRow as addManualRowTo,
  addRow,
  bare,
  bulkFirstGiven as bulkFirstGivenOf,
  bulkOpenAll as bulkOpenAllOf,
  fromDictionary,
  packOf,
  paradigmOf,
  pickParadigm as pickParadigmOf,
  removeAccept as removeAcceptFrom,
  removeRow as removeRowFrom,
  setCellMode as setCellModeOf,
  setCellValue as setCellValueOf,
  setInstruction as setInstructionOf,
  setLemma as setLemmaOf,
  setWhy as setWhyOf,
  slotsInPlay,
  toggleSlot as toggleSlotOf,
  updateInput as updateInputOf,
  updateSettings as updateSettingsOf,
  type CellMode,
  type DictionaryEntry,
  type InflectionTableContent,
  type InputSettings,
  type Settings,
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

/**
 * The document as the builder holds it: the kernel's content plus the row's token and the
 * audio layer's draft (plan 56). Same envelope as `sort_into_buckets` and `highlight_in_text`:
 * the layer belongs to no template, so it rides beside the document, not inside the kernel's.
 */
export interface InflectionTableDocument extends InflectionTableContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
  audio: AudioDraft;
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

/**
 * A typed row's given cell follows the lemma — «ei bok» gives `bok` — for as long as the author has
 * not written anything else there. A row linked to the dictionary has its forms from the entry.
 */
export function setLemma<T extends Doc>(ex: T, rowId: string, lemma: string): T {
  const next = setLemmaOf(ex, rowId, lemma);
  const pack = packOf(ex);
  const row = ex.rows.find((r) => r.id === rowId);
  const first = slotsInPlay(ex)[0];
  if (!pack || !row || row.dictId !== null || !first) return keep(ex, next);
  const cell = row.cells[first.id];
  if (!cell || cell.mode !== 'prefill' || cell.value !== bare(row.lemma, pack)) {
    return keep(ex, next);
  }
  return keep(ex, setCellValueOf(next, rowId, first.id, bare(lemma, pack)));
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

// ── Step 3 ──────────────────────────────────────────────────────────────────

export function setWhy<T extends Doc>(ex: T, rowId: string, slotId: string, why: string): T {
  return keep(ex, setWhyOf(ex, rowId, slotId, why));
}

/** A variant for this cell only; the kernel trims it and refuses an empty, doubled or key-equal one. */
export function addAccept<T extends Doc>(ex: T, rowId: string, slotId: string, variant: string): T {
  return keep(ex, addAcceptTo(ex, rowId, slotId, variant));
}

export function removeAccept<T extends Doc>(
  ex: T,
  rowId: string,
  slotId: string,
  index: number,
): T {
  return keep(ex, removeAcceptFrom(ex, rowId, slotId, index));
}

// ── Step 4 ──────────────────────────────────────────────────────────────────

export function setInput<T extends Doc>(ex: T, patch: Partial<InputSettings>): T {
  return keep(ex, updateInputOf(ex, patch));
}

export function setSettings<T extends Doc>(ex: T, patch: Partial<Settings>): T {
  return keep(ex, updateSettingsOf(ex, patch));
}
