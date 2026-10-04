import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  addQuestion as addQuestionTo,
  applyText,
  clearMarks as clearMarksOf,
  dropOrphan as dropOrphanFrom,
  putBack as putBackIn,
  removeQuestion as removeQuestionFrom,
  removeSpan as removeSpanFrom,
  resizeMark as resizeMarkIn,
  setSpanWhy as setSpanWhyIn,
  toggleMark as toggleMarkIn,
  update,
  updateQuestion as updateQuestionIn,
  updateSettings as updateSettingsOf,
  type HighlightInTextContent,
  type Question,
  type Settings,
} from '@/lib/shared-kernel/highlight-in-text';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 67 §4.1).
 *
 * Every cascade — a deleted question taking its orphans with it (AC-A6), a drag replacing the
 * marks it crosses, re-anchoring on a text edit (AC-R1–R4) — is the kernel's and is tested
 * there. What is here is only the shape: the builder holds a document that carries more than
 * the kernel's (`updatedAt`, the audio draft), and the kernel returns the plain content.
 * `keep` lays the result over the document so the extras survive.
 */
type Doc = HighlightInTextContent;

/**
 * The document as the builder holds it: the kernel's content plus the row's token and the
 * audio layer's draft (plan 56). Same envelope as `sort_into_buckets`.
 */
export interface HighlightInTextDocument extends HighlightInTextContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
  audio: AudioDraft;
}

function keep<T extends Doc>(ex: T, next: Doc): T {
  return { ...ex, ...next };
}

export function setTitle<T extends Doc>(ex: T, title: string): T {
  return keep(ex, update(ex, { title }));
}

export function setInstruction<T extends Doc>(ex: T, instruction: string): T {
  return keep(ex, update(ex, { instruction }));
}

/** Commit a new passage; every mark is re-found or becomes an orphan (step 1, «Apply the edit»). */
export function setText<T extends Doc>(ex: T, text: string): T {
  return keep(ex, applyText(ex, text));
}

// ── Questions ───────────────────────────────────────────────────────────────

/** Appends an empty question and says which one it is, so the tab can open on it. */
export function addQuestion<T extends Doc>(ex: T): { ex: T; added: string | null } {
  const next = addQuestionTo(ex);
  const added =
    next.questions.length > ex.questions.length ? (next.questions.at(-1)?.id ?? null) : null;
  return { ex: keep(ex, next), added };
}

export function removeQuestion<T extends Doc>(ex: T, qid: string): T {
  return keep(ex, removeQuestionFrom(ex, qid));
}

export function setQuestion<T extends Doc>(
  ex: T,
  qid: string,
  patch: Partial<Pick<Question, 'prompt' | 'unit' | 'missHint' | 'fpHint'>>,
): T {
  return keep(ex, updateQuestionIn(ex, qid, patch));
}

// ── Marks ───────────────────────────────────────────────────────────────────

/** A click or drag on the canvas. `added` is the new span, for the canvas to outline. */
export function toggleMark<T extends Doc>(
  ex: T,
  qid: string,
  origin: number,
  end: number,
): { ex: T; added: string | null } {
  const edit = toggleMarkIn(ex, qid, origin, end);
  return { ex: keep(ex, edit.ex), added: edit.added };
}

export function resizeMark<T extends Doc>(ex: T, qid: string, spanId: string, delta: 1 | -1): T {
  return keep(ex, resizeMarkIn(ex, qid, spanId, delta));
}

export function clearMarks<T extends Doc>(ex: T, qid: string): T {
  return keep(ex, clearMarksOf(ex, qid));
}

export function removeSpan<T extends Doc>(ex: T, qid: string, spanId: string): T {
  return keep(ex, removeSpanFrom(ex, qid, spanId));
}

export function setSpanWhy<T extends Doc>(ex: T, qid: string, spanId: string, why: string): T {
  return keep(ex, setSpanWhyIn(ex, qid, spanId, why));
}

// ── Orphans ─────────────────────────────────────────────────────────────────

export function putBack<T extends Doc>(ex: T, orphanId: string): T {
  return keep(ex, putBackIn(ex, orphanId));
}

export function dropOrphan<T extends Doc>(ex: T, orphanId: string): T {
  return keep(ex, dropOrphanFrom(ex, orphanId));
}

// ── Settings ────────────────────────────────────────────────────────────────

export function setSettings<T extends Doc>(ex: T, patch: Partial<Settings>): T {
  return keep(ex, updateSettingsOf(ex, patch));
}
