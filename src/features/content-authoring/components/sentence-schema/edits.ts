// Editing operations on a `sentence_schema` document, for the builder.
//
// Everything here is pure: document in, document out. Anything *derived* — what is wrong
// with the document, what a row would grade as, what the student would be sent — belongs
// to `@/lib/shared-kernel/sentence-schema` and is never recomputed here. This file only
// rewrites what the author typed.
//
// The same division as `short-answer/edits.ts`, and for the same reason: the kernel is
// what the server reads too, so anything this file worked out for itself would be a
// second opinion about the same document.
//
// One rule governs half the functions below, and it is the first pitfall in
// IMPLEMENTATION.md: **field ids are scoped to a clause type.** Changing a row's clause,
// or swapping the language pack, invalidates every placement in reach. Nothing here tries
// to remap them heuristically — it clears them, and the builder says so before the click.

import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  join as joinChunks,
  newExtra,
  newField,
  newRow,
  parseBulk,
  applyBulk,
  preset,
  retokenize,
  split as splitChunk,
  type Chunk,
  type ClauseId,
  type Field,
  type Row,
  type SentenceSchemaContent,
  type Settings,
} from '@/lib/shared-kernel/sentence-schema';

/**
 * The document as the builder holds it: the kernel's content plus the row's token.
 *
 * The envelope lives here rather than in the kernel because the kernel is shared with the
 * services, and `updatedAt` is a fact about a Prisma row — the same shape plan 51 settled
 * on for `short_answer`, for the same reason.
 */
export interface SentenceSchemaDocument extends SentenceSchemaContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
  /**
   * The listening layer, edited beside the document (plan 56 phase 6).
   *
   * Outside `SentenceSchemaContent` for the reason the layer exists: the same block hangs
   * on every template, and `toContent` builds an explicit object that would drop a field
   * it does not know about. `applyAudioDraft` writes it back at save time.
   */
  audio: AudioDraft;
}

/** Only has to be unique within one exercise and stable across the edit session. */
export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ── Step 1 · the schema ─────────────────────────────────────────────────────

/** Whether any row has a chunk placed — what makes a pack switch destructive. */
export function hasPlacements(ex: SentenceSchemaContent): boolean {
  return ex.rows.some((row) => row.chunks.some((chunk) => chunk.field !== null));
}

/**
 * Seed the schema from a language pack, clearing every placement in the document.
 *
 * The clearing is not caution, it is arithmetic: the pack mints fresh field ids, so every
 * `chunk.field` in the document would point at a field that no longer exists. The builder
 * warns before the click (BEHAVIOR, "a warning callout is visible before the click"),
 * which is the only protection there can be for an operation with no inverse.
 */
export function applyPreset<T extends SentenceSchemaContent>(ex: T, presetId: string): T {
  return {
    ...ex,
    presetId,
    schema: preset(presetId).build(),
    rows: ex.rows.map(clearPlacements),
  };
}

/**
 * Switch a clause type on or off.
 *
 * Switching one off does not touch the rows written in it — they keep their schema and
 * keep working (`ROW_CLAUSE_OFF` is a warning, not a blocker). It only means no new
 * sentence can choose it.
 */
export function toggleClause<T extends SentenceSchemaContent>(ex: T, clause: ClauseId): T {
  const on = ex.clauses.includes(clause);
  return {
    ...ex,
    clauses: on ? ex.clauses.filter((c) => c !== clause) : [...ex.clauses, clause],
  };
}

export type FieldPatch = Partial<Pick<Field, 'short' | 'label' | 'hint' | 'optional'>>;

export function setField<T extends SentenceSchemaContent>(
  ex: T,
  clause: ClauseId,
  fieldId: string,
  patch: FieldPatch,
): T {
  return mapFields(ex, clause, (fields) =>
    fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
  );
}

/** A new field at the end, keyed by its position — the handoff's `{ short: n+1 }`. */
export function addField<T extends SentenceSchemaContent>(
  ex: T,
  clause: ClauseId,
  label: string,
): T {
  return mapFields(ex, clause, (fields) => [
    ...fields,
    { ...newField(String(fields.length + 1), label, '', true), id: newId() },
  ]);
}

/**
 * Move a field one place along. Display order only — placements are untouched, because a
 * placement points at an id and the id has not moved.
 */
export function moveField<T extends SentenceSchemaContent>(
  ex: T,
  clause: ClauseId,
  fieldId: string,
  direction: -1 | 1,
): T {
  return mapFields(ex, clause, (fields) => {
    const from = fields.findIndex((f) => f.id === fieldId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= fields.length) return fields;
    const next = [...fields];
    [next[from], next[to]] = [next[to]!, next[from]!];
    return next;
  });
}

/**
 * Delete a field, and unplace everything that was in it.
 *
 * The quiet half is the important one (plan 52 §6.2): removing a field makes every row
 * that used it undeliverable, and the author gets no dialogue about it — only the card's
 * `N words left` and the rail dot going back to amber. That is the check on "one
 * validation engine": if the dot stayed green, the two would already have drifted.
 */
export function removeField<T extends SentenceSchemaContent>(
  ex: T,
  clause: ClauseId,
  fieldId: string,
): T {
  const withoutField = mapFields(ex, clause, (fields) => fields.filter((f) => f.id !== fieldId));
  return {
    ...withoutField,
    rows: withoutField.rows.map((row) =>
      row.clause !== clause
        ? row
        : {
            ...row,
            chunks: row.chunks.map((chunk) => ({
              ...chunk,
              field: chunk.field === fieldId ? null : chunk.field,
              alt: chunk.alt.filter((id) => id !== fieldId),
            })),
          },
    ),
  };
}

// ── Step 2 · the sentences ──────────────────────────────────────────────────

export function addRow<T extends SentenceSchemaContent>(ex: T, clause: ClauseId): T {
  return { ...ex, rows: [...ex.rows, { ...newRow(clause), id: newId() }] };
}

export function removeRow<T extends SentenceSchemaContent>(ex: T, rowId: string): T {
  return { ...ex, rows: ex.rows.filter((row) => row.id !== rowId) };
}

/** Drag-reorder from the shared reorder list. The set's order is the order it is played. */
export function reorderRows<T extends SentenceSchemaContent>(ex: T, rows: Row[]): T {
  return { ...ex, rows };
}

/**
 * Rewrite the sentence, carrying every placement the new text can still hold.
 *
 * Runs on every keystroke. `retokenize` is the kernel's, not this file's, and that is the
 * whole point: fixing a typo after placing eight chunks must not lose them
 * (IMPLEMENTATION.md, "Re-tokenizing must preserve work").
 */
export function setRowText<T extends SentenceSchemaContent>(ex: T, rowId: string, text: string): T {
  return mapRow(ex, rowId, (row) => ({ ...row, text, chunks: retokenize(text, row.chunks) }));
}

/**
 * The sentence the student starts from, in a transformation task.
 *
 * A prompt and nothing else — never tokenized, never banked, never graded (plan 52 §3.8).
 * That is why this is a one-line setter and not a sibling of `setRowText`.
 */
export function setRowSource<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  source: string,
): T {
  return mapRow(ex, rowId, (row) => ({ ...row, source }));
}

/** Change a row's clause type. Clears its placements: the field ids belonged to the old one. */
export function setRowClause<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  clause: ClauseId,
): T {
  return mapRow(ex, rowId, (row) => clearPlacements({ ...row, clause }));
}

/**
 * Place a chunk in a field.
 *
 * The field is dropped from `alt` if it was there: "also correct in" is about the fields
 * this chunk does *not* belong to, and a field that is both the answer and an alternative
 * is a contradiction the grader would silently resolve in favour of the answer.
 */
export function assignChunk<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  chunkId: string,
  fieldId: string,
): T {
  return mapChunks(ex, rowId, (chunks) =>
    chunks.map((c) =>
      c.id === chunkId ? { ...c, field: fieldId, alt: c.alt.filter((id) => id !== fieldId) } : c,
    ),
  );
}

/** Take a chunk off the board. Its alternatives go with it — they were about a placement. */
export function unassignChunk<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  chunkId: string,
): T {
  return mapChunks(ex, rowId, (chunks) =>
    chunks.map((c) => (c.id === chunkId ? { ...c, field: null, alt: [] } : c)),
  );
}

/** Toggle a field in a chunk's "also accepted here" set. */
export function toggleAlt<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  chunkId: string,
  fieldId: string,
): T {
  return mapChunks(ex, rowId, (chunks) =>
    chunks.map((c) =>
      c.id !== chunkId
        ? c
        : {
            ...c,
            alt: c.alt.includes(fieldId)
              ? c.alt.filter((id) => id !== fieldId)
              : [...c.alt, fieldId],
          },
    ),
  );
}

/** Join a chunk with the one after it — how "one element" in the V2 sense is expressed. */
export function joinAt<T extends SentenceSchemaContent>(ex: T, rowId: string, index: number): T {
  return mapChunks(ex, rowId, (chunks) => joinChunks(chunks, index));
}

/** Break a joined chunk back into its words, each keeping the field. */
export function splitAt<T extends SentenceSchemaContent>(ex: T, rowId: string, index: number): T {
  return mapChunks(ex, rowId, (chunks) => splitChunk(chunks, index));
}

/** A distractor for the bank. Never part of `chunks`, so never part of the answer. */
export function addExtra<T extends SentenceSchemaContent>(ex: T, rowId: string, text: string): T {
  const value = text.trim();
  if (value === '') return ex;
  return mapRow(ex, rowId, (row) => ({
    ...row,
    extras: [...row.extras, { ...newExtra(value), id: newId() }],
  }));
}

export function removeExtra<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  extraId: string,
): T {
  return mapRow(ex, rowId, (row) => ({
    ...row,
    extras: row.extras.filter((extra) => extra.id !== extraId),
  }));
}

/**
 * Apply a bulk paste: parse the text against the current schema, then drop the empty rows
 * that were standing in for it.
 *
 * Ids are re-minted here for the same reason as everywhere else in this file — the
 * kernel's factories mint from `Math.random` because they also run on a server, and the
 * browser has one source of ids that should stay the only one.
 */
export function applyBulkPaste<T extends SentenceSchemaContent>(
  ex: T,
  text: string,
  defaultClause: ClauseId,
): T {
  const parsed = parseBulk(text, { schema: ex.schema, defaultClause }).map(withIds);
  return { ...ex, rows: applyBulk(ex.rows, parsed) };
}

// ── Step 3 · difficulty ─────────────────────────────────────────────────────

export function setSettings<T extends SentenceSchemaContent>(ex: T, patch: Partial<Settings>): T {
  return { ...ex, settings: { ...ex.settings, ...patch } };
}

// ── Step 4 · feedback ───────────────────────────────────────────────────────

/** The rule this sentence teaches. Required before the exercise may be assigned. */
export function setWhy<T extends SentenceSchemaContent>(ex: T, rowId: string, why: string): T {
  return mapRow(ex, rowId, (row) => ({ ...row, why }));
}

/**
 * The note shown instead of the default when one chunk lands in the wrong field.
 *
 * An emptied note is deleted rather than stored blank: `passes.chunkNotes` counts what is
 * written, and a map full of empty strings would count them as coverage.
 */
export function setChunkNote<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  chunkId: string,
  note: string,
): T {
  return mapRow(ex, rowId, (row) => {
    const fb = { ...row.fb };
    if (note.trim() === '') delete fb[chunkId];
    else fb[chunkId] = note;
    return { ...row, fb };
  });
}

// ── Internals ───────────────────────────────────────────────────────────────

function clearPlacements(row: Row): Row {
  return { ...row, chunks: row.chunks.map((chunk) => ({ ...chunk, field: null, alt: [] })) };
}

function mapFields<T extends SentenceSchemaContent>(
  ex: T,
  clause: ClauseId,
  map: (fields: Field[]) => Field[],
): T {
  return { ...ex, schema: { ...ex.schema, [clause]: map(ex.schema[clause] ?? []) } };
}

function mapRow<T extends SentenceSchemaContent>(ex: T, rowId: string, map: (row: Row) => Row): T {
  return { ...ex, rows: ex.rows.map((row) => (row.id === rowId ? map(row) : row)) };
}

function mapChunks<T extends SentenceSchemaContent>(
  ex: T,
  rowId: string,
  map: (chunks: Chunk[]) => Chunk[],
): T {
  return mapRow(ex, rowId, (row) => ({ ...row, chunks: map(row.chunks) }));
}

function withIds(row: Row): Row {
  return {
    ...row,
    id: newId(),
    chunks: row.chunks.map((chunk): Chunk => ({ ...chunk, id: newId() })),
    extras: row.extras.map((extra) => ({ ...extra, id: newId() })),
  };
}
