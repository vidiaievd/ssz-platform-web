// Editing operations on a `short_answer` document, for the builder.
//
// Everything here is pure: document in, document out. The derived side — what an answer
// covers, what is wrong with the document, what the student would be sent — belongs to
// `@/lib/shared-kernel/short-answer` and is never recomputed here. This file only
// rewrites what the author typed.
//
// The same division as `writing-task/edits.ts`, and for the same reason: the kernel is
// what the server reads too, so anything this file worked out for itself would be a
// second opinion about the same document.

import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  newElement,
  newQuestion,
  type KeyElement,
  type Question,
  type QuestionKind,
  type Settings,
  type ShortAnswerContent,
} from '@/lib/shared-kernel/short-answer';

/**
 * The document as the builder holds it: the kernel's content plus the row's token.
 *
 * The envelope lives here rather than in the kernel because the kernel is shared with the
 * services, and `updatedAt` is a fact about a Prisma row — the four builders before this
 * one carry it inside their kernel document, which is the shape plan 51 §4 deliberately
 * did not copy: `short_answer`'s kernel is a document and a grader, and nothing in it
 * needs to know that the web client saves with an optimistic-concurrency token.
 */
export interface ShortAnswerDocument extends ShortAnswerContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
  /**
   * The listening layer, edited beside the document (plan 56 phase 5).
   *
   * Outside `ShortAnswerContent` for the reason the layer exists at all: the same block
   * hangs on every template, and `toContent` builds an explicit object that would drop a
   * field it does not know about. `applyAudioDraft` writes it back at save time.
   */
  audio: AudioDraft;
}

/** Beyond five elements a question stops being a short answer and becomes an essay. */
export const MAX_ELEMENTS = 5;

/** Only has to be unique within one exercise and stable across the edit session. */
export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ── Questions ───────────────────────────────────────────────────────────────

export type QuestionPatch = Partial<
  Pick<Question, 'kind' | 'passage' | 'prompt' | 'model' | 'why'>
>;

export function setQuestion<T extends ShortAnswerContent>(
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
 * `opinion` stops rendering the passage field but does not clear it (BEHAVIOR §"Step 1":
 * "any existing passage is kept in the model but hidden"). An author correcting the kind
 * of a question they mislabelled must not lose the text they pasted — and the projection
 * decides what the student sees from `kind` alone, so a kept passage cannot leak.
 */
export function setKind<T extends ShortAnswerContent>(
  ex: T,
  questionId: string,
  kind: QuestionKind,
): T {
  return setQuestion(ex, questionId, { kind });
}

export function addQuestion<T extends ShortAnswerContent>(ex: T): T {
  return { ...ex, questions: [...ex.questions, withIds(newQuestion())] };
}

/**
 * A deep copy inserted after the original, with new ids for the question **and every
 * element**.
 *
 * The elements matter as much as the question: the key column is keyed by question id and
 * the breakdown by element id, so a duplicate that reused them would give two questions
 * one shared key — and the first edit to either would silently rewrite both.
 */
export function duplicateQuestion<T extends ShortAnswerContent>(ex: T, questionId: string): T {
  return {
    ...ex,
    questions: ex.questions.flatMap((q) =>
      q.id === questionId
        ? [
            q,
            {
              ...q,
              id: newId(),
              elements: q.elements.map((e) => ({ ...e, id: newId() })),
            },
          ]
        : [q],
    ),
  };
}

/**
 * Remove a question, including the last one.
 *
 * Unlike an element, a question has nothing below it to protect: "no questions at all" is
 * a step-1 blocker the author sees immediately, and an author who wants to start the set
 * over is entitled to empty it. BEHAVIOR §"Step 1" asks for no confirmation.
 */
export function removeQuestion<T extends ShortAnswerContent>(ex: T, questionId: string): T {
  return { ...ex, questions: ex.questions.filter((q) => q.id !== questionId) };
}

// ── Key elements ────────────────────────────────────────────────────────────

export type ElementPatch = Partial<Pick<KeyElement, 'label' | 'required'>>;

export function setElement<T extends ShortAnswerContent>(
  ex: T,
  questionId: string,
  elementId: string,
  patch: ElementPatch,
): T {
  return mapElements(ex, questionId, (elements) =>
    elements.map((e) => (e.id === elementId ? { ...e, ...patch } : e)),
  );
}

/** A new empty row, up to `MAX_ELEMENTS`. Beyond that the document is returned untouched. */
export function addElement<T extends ShortAnswerContent>(ex: T, questionId: string): T {
  const question = ex.questions.find((q) => q.id === questionId);
  if (!question || question.elements.length >= MAX_ELEMENTS) return ex;
  return mapElements(ex, questionId, (elements) => [...elements, withId(newElement())]);
}

/**
 * Remove an element, never the last one.
 *
 * "No usable key element" is a blocker, and a builder that let the author delete their way
 * into it would be offering a button whose only effect is a red dot on the rail. The row's
 * delete is disabled at one; this is the same rule where it cannot be bypassed.
 */
export function removeElement<T extends ShortAnswerContent>(
  ex: T,
  questionId: string,
  elementId: string,
): T {
  const question = ex.questions.find((q) => q.id === questionId);
  if (!question || question.elements.length <= 1) return ex;
  return mapElements(ex, questionId, (elements) => elements.filter((e) => e.id !== elementId));
}

// ── Anchor phrases ──────────────────────────────────────────────────────────

/**
 * Add a phrasing to an element, trimmed, ignoring blanks and ones already there.
 *
 * The duplicate guard is not tidiness: `hasAnchor` stops at the first anchor that matches,
 * so a repeated phrase can never change a verdict — it can only make the audit's "only one
 * variant" advice look answered when it is not.
 */
export function addAnchor<T extends ShortAnswerContent>(
  ex: T,
  questionId: string,
  elementId: string,
  anchor: string,
): T {
  const value = anchor.trim();
  if (value === '') return ex;
  const element = ex.questions
    .find((q) => q.id === questionId)
    ?.elements.find((e) => e.id === elementId);
  if (!element || element.anchors.includes(value)) return ex;
  return mapElements(ex, questionId, (elements) =>
    elements.map((e) => (e.id === elementId ? { ...e, anchors: [...e.anchors, value] } : e)),
  );
}

export function removeAnchor<T extends ShortAnswerContent>(
  ex: T,
  questionId: string,
  elementId: string,
  anchor: string,
): T {
  return mapElements(ex, questionId, (elements) =>
    elements.map((e) =>
      e.id === elementId ? { ...e, anchors: e.anchors.filter((a) => a !== anchor) } : e,
    ),
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

export function setSettings<T extends ShortAnswerContent>(ex: T, patch: Partial<Settings>): T {
  return { ...ex, settings: { ...ex.settings, ...patch } };
}

// ── Internals ───────────────────────────────────────────────────────────────

function mapElements<T extends ShortAnswerContent>(
  ex: T,
  questionId: string,
  map: (elements: KeyElement[]) => KeyElement[],
): T {
  return {
    ...ex,
    questions: ex.questions.map((q) =>
      q.id === questionId ? { ...q, elements: map(q.elements) } : q,
    ),
  };
}

/**
 * The kernel's factories mint a short random id of their own, which is right where they
 * run — on a server with no `crypto.randomUUID` guarantee. In the browser there is one,
 * and every other builder mints ids from it; re-stamping here keeps one source of ids in
 * this document rather than two that could, however unlikely, collide.
 */
function withId(element: KeyElement): KeyElement {
  return { ...element, id: newId() };
}

function withIds(question: Question): Question {
  return { ...question, id: newId(), elements: question.elements.map(withId) };
}
