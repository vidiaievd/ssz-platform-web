// Editing operations on a `multiple_choice` document, for the builder.
//
// Everything here is pure: document in, document out. Anything *derived* — what is wrong
// with the document, what the audit says about a distractor, what the student would be
// sent — belongs to `@/lib/shared-kernel/multiple-choice` and is never recomputed here.
// This file only rewrites what the author typed.
//
// The same division as `short-answer/edits.ts` and `sentence-schema/edits.ts`, and for the
// same reason: the kernel is what the server reads too, so anything this file worked out
// for itself would be a second opinion about the same document.
//
// One rule is not here, and its absence is deliberate: **"exactly one key" lives in the
// kernel** (`setKey` in `derive.ts`). Marking an option correct is a rule of the model
// rather than a convenience of the editor — the validator, the projection and the grader
// all assume `correctOption` is unambiguous, and an editor that set the flag directly
// could break that assumption in one keystroke.

import {
  newOption,
  newQuestion,
  parseBulk,
  setKey,
  type MultipleChoiceContent,
  type Option,
  type Question,
  type QuestionKind,
  type Settings,
} from '@/lib/shared-kernel/multiple-choice';

/**
 * The document as the builder holds it: the kernel's content plus the row's token.
 *
 * The envelope lives here rather than in the kernel because the kernel is shared with the
 * services, and `updatedAt` is a fact about a Prisma row — the shape plan 51 settled on
 * for `short_answer` and plan 52 repeated for `sentence_schema`.
 */
export interface MultipleChoiceDocument extends MultipleChoiceContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
}

/** README "Step 1": `Add option` is disabled at eight. */
export const MAX_OPTIONS = 8;
/** A question with one option is not a question. `Delete option` is disabled at two. */
export const MIN_OPTIONS = 2;

/** Only has to be unique within one exercise and stable across the edit session. */
export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ── Questions ───────────────────────────────────────────────────────────────

export type QuestionPatch = Partial<Pick<Question, 'kind' | 'context' | 'stem' | 'why'>>;

export function setQuestion<T extends MultipleChoiceContent>(
  ex: T,
  questionId: string,
  patch: QuestionPatch,
): T {
  return {
    ...ex,
    questions: ex.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
  };
}

/**
 * Switch a question's kind, keeping the passage it already has.
 *
 * A passage written before the kind was changed stays in the document and simply stops
 * being offered — the projection reads `kind`, so a kept passage cannot leak (the same
 * arrangement `short_answer` uses for `opinion`). An author correcting a mislabelled
 * question must not lose the text they pasted.
 */
export function setKind<T extends MultipleChoiceContent>(
  ex: T,
  questionId: string,
  kind: QuestionKind,
): T {
  return setQuestion(ex, questionId, { kind });
}

/** A new question at the end: `grammar`, empty stem, three empty options, no key. */
export function addQuestion<T extends MultipleChoiceContent>(ex: T): T {
  return { ...ex, questions: [...ex.questions, withIds(newQuestion())] };
}

/**
 * A deep copy inserted directly after the original, with new ids for the question **and
 * every option** — BEHAVIOR, step 1.
 *
 * The options matter as much as the question: the key column is keyed by question id and
 * by option id inside it, so a duplicate that reused them would give two questions one
 * shared key, and the first edit to either would silently rewrite both. The kernel's
 * `duplicateQuestion` mints ids from `Math.random` because it also runs on a server; the
 * browser has one source of ids and this keeps it the only one.
 */
export function duplicateQuestion<T extends MultipleChoiceContent>(ex: T, questionId: string): T {
  return {
    ...ex,
    questions: ex.questions.flatMap((q) => (q.id === questionId ? [q, withIds(q)] : [q])),
  };
}

/**
 * Remove a question, including the last one.
 *
 * "No questions at all" is a step-1 blocker the author sees immediately, and an author
 * who wants to start the set over is entitled to empty it. BEHAVIOR §"Step 1" asks for
 * no confirmation: the deletion is undone by the builder's own revert, and a dialogue in
 * front of every removed question charges the common case for the rare one.
 */
export function removeQuestion<T extends MultipleChoiceContent>(ex: T, questionId: string): T {
  return { ...ex, questions: ex.questions.filter((q) => q.id !== questionId) };
}

// ── Options ─────────────────────────────────────────────────────────────────

export type OptionPatch = Partial<Pick<Option, 'text' | 'why' | 'fixed'>>;

export function setOption<T extends MultipleChoiceContent>(
  ex: T,
  questionId: string,
  optionId: string,
  patch: OptionPatch,
): T {
  return mapQuestion(ex, questionId, (q) => ({
    ...q,
    options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
  }));
}

/**
 * Mark this option as the answer key, clearing every other in the question.
 *
 * A one-line delegation on purpose: the rule belongs to the model, and a builder that
 * spelled it out here would be the second place it is written down.
 */
export function markKey<T extends MultipleChoiceContent>(
  ex: T,
  questionId: string,
  optionId: string,
): T {
  return mapQuestion(ex, questionId, (q) => setKey(q, optionId));
}

/** One more empty option, up to eight. Above that the call is a no-op, as the button is. */
export function addOption<T extends MultipleChoiceContent>(ex: T, questionId: string): T {
  return mapQuestion(ex, questionId, (q) =>
    q.options.length >= MAX_OPTIONS ? q : { ...q, options: [...q.options, { ...newOption(), id: newId() }] },
  );
}

/**
 * Remove an option — never below two.
 *
 * The floor is enforced here as well as on the button, because a document with one option
 * is not something the model should be able to reach by any route: it is not answerable,
 * and the runner would render a question with a single thing to press.
 */
export function removeOption<T extends MultipleChoiceContent>(
  ex: T,
  questionId: string,
  optionId: string,
): T {
  return mapQuestion(ex, questionId, (q) =>
    q.options.length <= MIN_OPTIONS
      ? q
      : { ...q, options: q.options.filter((o) => o.id !== optionId) },
  );
}

// ── Bulk paste ──────────────────────────────────────────────────────────────

/**
 * Append the questions of a bulk paste — `Stem | *right | wrong | wrong`.
 *
 * Appends rather than replaces (BEHAVIOR §"Step 1"), and re-mints every id for the reason
 * given above `duplicateQuestion`. The parse itself is the kernel's: `*` marks the key,
 * an unstarred line makes its first option the key, and a line with no `|` becomes a stem
 * with two empty options.
 *
 * This is what the whole step is for on a real set. Five questions with four options each
 * is thirty fields typed one at a time, or one paste.
 */
export function applyBulkPaste<T extends MultipleChoiceContent>(ex: T, text: string): T {
  return { ...ex, questions: [...ex.questions, ...parseBulk(text).map(withIds)] };
}

// ── Settings ────────────────────────────────────────────────────────────────

export function setSettings<T extends MultipleChoiceContent>(ex: T, patch: Partial<Settings>): T {
  return { ...ex, settings: { ...ex.settings, ...patch } };
}

// ── Internals ───────────────────────────────────────────────────────────────

function mapQuestion<T extends MultipleChoiceContent>(
  ex: T,
  questionId: string,
  map: (q: Question) => Question,
): T {
  return { ...ex, questions: ex.questions.map((q) => (q.id === questionId ? map(q) : q)) };
}

function withIds(q: Question): Question {
  return { ...q, id: newId(), options: q.options.map((o) => ({ ...o, id: newId() })) };
}
