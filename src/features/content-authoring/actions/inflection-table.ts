'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  emptyContent,
  instructionFor,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/inflection-table';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveInflectionTableInput {
  /** The persisted document — the template's own shape, plus the audio block when on (plan 56). */
  content: PersistedContent & Record<string, unknown>;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveInflectionTableOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the `inflection_table` builder — the same conditional write as the builders
 * before it (plan 67 §5, deviation 4).
 *
 * Both columns go every time, and for this type that is the shape of the document: the
 * forms of the asked cells, their variants and their reasons are **only** in
 * `expectedAnswers`, keyed by `rowId:slotId` (plan 69 §3.2). A `content` written without them would leave the
 * table of rows with no key, and every check would find nothing to compare with.
 */
export async function saveInflectionTableAction(
  exerciseId: string,
  containerId: string,
  input: SaveInflectionTableInput,
): Promise<Result<SaveInflectionTableOutcome>> {
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
      // The service's own sentence when it sent one — the BFF's wrapper only says which
      // request failed.
      const upstream = readUpstreamMessage(error.details);
      return err({ ...error.toJSON(), ...(upstream === null ? {} : { message: upstream }) });
    }
    throw error;
  }
}

function readUpstreamMessage(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['message'];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readCurrentUpdatedAt(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['currentUpdatedAt'];
  return typeof value === 'string' ? value : null;
}

/**
 * The document a new inflection table starts as: the course language's first paradigm with
 * every slot in play, no rows, the default settings (`emptyContent`).
 *
 * The instruction is the author's when they wrote one in the picker, otherwise the course
 * language's pack line — and empty where there is no pack, never a Norwegian default baked
 * in here (plan 69 §3.7). Nothing pretends to be ready: the blockers are the rail's and the
 * gate's to report from the first mount (IT-B1).
 *
 * Dispatch is by template code, so every `inflection_table` exercise belongs to the
 * builder; without a scaffold the generic form would create a document the builder cannot
 * open meaningfully (plan 53's lesson).
 */
function scaffold(
  instruction: string,
  targetLanguage: string,
): { content: PersistedContent; answers: PersistedAnswers; instruction: string } {
  const line = instruction !== '' ? instruction : instructionFor(targetLanguage);
  const doc = { ...emptyContent(targetLanguage), instruction: line };
  return { content: toContent(doc), answers: toExpectedAnswers(doc), instruction: line };
}

/** Create a `inflection_table` exercise and file it in the module's draft. */
export async function createInflectionTableAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);
    const { content, answers, instruction } = scaffold(instructions.trim(), targetLanguage);

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
      body: { instructionLanguage: INSTRUCTION_LANGUAGE, instructionText: instruction },
    });

    const item = await addItemToDraft(containerId, 'exercise', exerciseId);
    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId, itemId: item.id };
  });
}
