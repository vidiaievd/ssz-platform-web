'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import type { LessonSpanKind, LessonTextSpan } from '@/features/content/types';

export interface CreateTextSpanInput {
  /** 0-based index into the blank-line split of the body — the same numbering as paragraph translations. */
  paragraphIndex: number;
  /** UTF-16 offset into the paragraph's raw markdown, not into the rendered text. */
  charStart: number;
  /** Exclusive end offset. */
  charEnd: number;
  kind: LessonSpanKind;
  /** Vocabulary item id for `vocab`, grammar rule id for `grammar`; omitted for `chunk`. */
  refId?: string;
  note?: string;
}

/**
 * Annotates a stretch of a TEXT variant's body (spec 16 §6.2).
 *
 * `textSnapshot` is deliberately not part of the input: the service slices it
 * out of the current paragraph itself. A caller whose offsets were computed
 * against a body that has since changed is therefore rejected, rather than
 * having its stale selection stored as a self-consistent record.
 *
 * For `kind: 'vocab'` this also upserts the variant's glossary mark and syncs
 * the word into every containing module — one call, not two.
 */
export async function createTextSpanAction(
  lessonId: string,
  variantId: string,
  input: CreateTextSpanInput,
) {
  return tryAction(async () => {
    return serverFetch<LessonTextSpan>({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/spans`,
      method: 'POST',
      body: input,
    });
  });
}

export interface UpdateTextSpanInput {
  /** The three anchor fields move together; sending a partial anchor mixes old and new coordinates. */
  paragraphIndex?: number;
  charStart?: number;
  charEnd?: number;
  /** `null` clears the note. */
  note?: string | null;
}

/**
 * Re-anchors a span or edits its note (spec 16 §6.3). `kind` and `refId` are
 * immutable — pointing an annotation at a different referent is a delete plus a
 * create, which keeps the glossary-mark coupling on the create path only.
 */
export async function updateTextSpanAction(
  lessonId: string,
  variantId: string,
  spanId: string,
  input: UpdateTextSpanInput,
) {
  return tryAction(async () => {
    return serverFetch<LessonTextSpan>({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/spans/${spanId}`,
      method: 'PATCH',
      body: input,
    });
  });
}

/**
 * Deletes a span (spec 16 §6.4). Idempotent, and it leaves the vocabulary
 * glossary mark alone: the mark also stands for module membership, which
 * outlives any single occurrence in one paragraph.
 */
export async function deleteTextSpanAction(
  lessonId: string,
  variantId: string,
  spanId: string,
) {
  return tryAction(async () => {
    await serverFetch<void>({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/spans/${spanId}`,
      method: 'DELETE',
    });
  });
}

/**
 * Removes a word from this variant's glossary (spec 16 §6.5) — the recovery
 * that the mark model never had. Cascades to this variant's `vocab` spans for
 * the same item, and deliberately leaves the module-level INTRODUCES relation
 * in place: detaching a word from a module is a module-level operation, and
 * doing it here would silently strip the word from the unit's vocabulary list
 * and from students' SRS seeding because of an edit to one lesson.
 */
export async function unmarkGlossaryWordAction(
  lessonId: string,
  variantId: string,
  vocabularyItemId: string,
) {
  return tryAction(async () => {
    await serverFetch<void>({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/glossary-marks/${vocabularyItemId}`,
      method: 'DELETE',
    });
  });
}
