'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  emptyContent,
  noneLabelFor,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/sort-into-buckets';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveSortIntoBucketsInput {
  /**
   * The persisted document — the template's own shape, plus the audio block when the
   * exercise has one. The layer belongs to no template (plan 56).
   */
  content: PersistedContent & Record<string, unknown>;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveSortIntoBucketsOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the sort-into-buckets builder.
 *
 * The same shape as the eight before it, and for the same reason: the builder owns the
 * whole document, so there is nothing to merge with the generic exercise form, and the
 * write has to be conditional — both columns are replaced wholesale, and two authors
 * saving in turn would otherwise erase each other silently.
 *
 * Both columns go every time, and for this type that is the shape of the document: which
 * bucket an item belongs in (and `also`, `why`, the explanations) is **only** in
 * `expectedAnswers`, keyed by item id. A `content` written without it would leave the key
 * pointing at items that no longer exist, and the board would grade every tile wrong while
 * looking correct on screen.
 */
export async function saveSortIntoBucketsAction(
  exerciseId: string,
  containerId: string,
  input: SaveSortIntoBucketsInput,
): Promise<Result<SaveSortIntoBucketsOutcome>> {
  try {
    const { updatedAt } = await serverFetch<{ updatedAt: string }>({
      service: 'content',
      path: `/exercises/${exerciseId}`,
      method: 'PATCH',
      body: {
        content: input.content,
        expectedAnswers: input.expectedAnswers,
        expectedUpdatedAt: input.expectedUpdatedAt,
      },
    });

    // Separate storage and separate history: the instruction row has no bearing on the
    // exercise's `updatedAt`, so writing it cannot invalidate the token just returned.
    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}/instructions`,
      method: 'POST',
      body: {
        instructionLanguage: INSTRUCTION_LANGUAGE,
        instructionText: input.instructions.trim(),
      },
    });

    revalidatePath(`/school/content/${containerId}`);
    return ok({ status: 'saved', updatedAt });
  } catch (error) {
    if (isAppError(error) && error.code === 'conflict') {
      return ok({ status: 'conflict', currentUpdatedAt: readCurrentUpdatedAt(error.details) });
    }
    if (isAppError(error)) {
      // The upstream's own sentence, when it sent one. `AppError.message` at this point is
      // the BFF's wrapper — "Upstream 422 on content/exercises/<uuid>" — which tells the
      // author which request failed and nothing about why. The service says why, and that
      // is the half worth showing: the difference between a dead end and a thing to fix.
      const upstream = readUpstreamMessage(error.details);
      return err({ ...error.toJSON(), ...(upstream === null ? {} : { message: upstream }) });
    }
    throw error;
  }
}

/** The `message` of the service's error body, if it sent one. */
function readUpstreamMessage(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['message'];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** `{ message, currentUpdatedAt }` from content-service, defended against any other shape. */
function readCurrentUpdatedAt(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['currentUpdatedAt'];
  return typeof value === 'string' ? value : null;
}

/**
 * The document a brand-new sorting task starts as: two empty buckets and three empty items,
 * as `emptyContent` defines it (AC-B1).
 *
 * Nothing pretends it is ready — the blockers are the gate's to report from the first
 * mount, and an untouched step reads as empty rather than wrong (plan 66 §4.2). The
 * instruction comes from the caller, never from a Norwegian default baked in here, and the
 * refusal bucket's label from the course language's pack — empty where there is none
 * (AC-X7, plan 53 §3.6).
 *
 * The scaffold is required rather than convenient: the template's content schema has no
 * `minItems`, so a document created by the generic form would be accepted and then be one
 * the builder cannot open meaningfully. Dispatch is by template code, so every
 * `sort_into_buckets` exercise belongs to the builder (plan 53's lesson).
 */
function scaffold(
  instruction: string,
  targetLanguage: string,
): { content: PersistedContent; answers: PersistedAnswers } {
  const doc = { ...emptyContent(noneLabelFor(targetLanguage)), instruction };
  return { content: toContent(doc), answers: toExpectedAnswers(doc) };
}

/** Create a `sort_into_buckets` exercise and file it in the module's draft. */
export async function createSortIntoBucketsAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);
    const { content, answers } = scaffold(instructions.trim(), targetLanguage);

    const { exerciseId } = await serverFetch<{ exerciseId: string }>({
      service: 'content',
      path: '/exercises',
      method: 'POST',
      body: {
        exerciseTemplateId,
        targetLanguage,
        difficultyLevel,
        content,
        expectedAnswers: answers,
        visibility,
        ...(ownerSchoolId ? { ownerSchoolId } : {}),
      },
    });

    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}/instructions`,
      method: 'POST',
      body: {
        instructionLanguage: INSTRUCTION_LANGUAGE,
        instructionText: instructions.trim(),
      },
    });

    const item = await addItemToDraft(containerId, 'exercise', exerciseId);
    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId, itemId: item.id };
  });
}
