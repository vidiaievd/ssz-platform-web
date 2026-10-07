'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  emptyContent,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/read-aloud';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveReadAloudInput {
  /** The persisted document — the template's own shape, plus the audio block when on (plan 56). */
  content: PersistedContent & Record<string, unknown>;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveReadAloudOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the `read_aloud` builder — the same conditional write as the builders before it
 * (plan 67 §5, deviation 4).
 *
 * Both columns go every time: the listening note, the focus words and the level descriptors are
 * **only** in `expectedAnswers`, keyed by prompt and criterion id (plan 70 §3.1), and a `content`
 * written without them would leave a rubric nobody can mark against.
 */
export async function saveReadAloudAction(
  exerciseId: string,
  containerId: string,
  input: SaveReadAloudInput,
): Promise<Result<SaveReadAloudOutcome>> {
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
    // The service refuses an empty instruction, and a line the author has not written yet is
    // not an error worth a «rejected» banner: the row keeps the one it has until there is a new
    // one (the preflight, not this write, is where a missing instruction is reported).
    if (input.instructions.trim() !== '') {
      await serverFetch({
        service: 'content',
        path: `/exercises/${exerciseId}/instructions`,
        method: 'POST',
        body: {
          instructionLanguage: INSTRUCTION_LANGUAGE,
          instructionText: input.instructions.trim(),
        },
      });
    }

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
 * The document a new read-aloud exercise starts as: one empty `read` prompt, the course
 * language's default rubric (empty wording where there is no default) and the dials of
 * DECISIONS §7 (`emptyContent`).
 *
 * The document's own instruction stays empty — the line is the author's to write in the course
 * language, and none is baked in here (README «Nothing Norwegian is hardcoded»). The instruction
 * *row* the platform requires before publishing gets the picker's placeholder meanwhile, so the
 * exercise can be created; the first save of a written line replaces it. Nothing pretends to be
 * ready: the blockers are the rail's and the gate's to report from the first mount (RA-B1).
 *
 * Dispatch is by template code, so every `read_aloud` exercise belongs to the builder; without
 * a scaffold the generic form would create a document the builder cannot open meaningfully
 * (plan 53's lesson).
 */
function scaffold(targetLanguage: string): {
  content: PersistedContent;
  answers: PersistedAnswers;
} {
  const doc = emptyContent(targetLanguage);
  return { content: toContent(doc), answers: toExpectedAnswers(doc) };
}

/** Create a `read_aloud` exercise and file it in the module's draft. */
export async function createReadAloudAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);
    const { content, answers } = scaffold(targetLanguage);

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
        instructionText: instructions.trim() || 'Read aloud.',
      },
    });

    const item = await addItemToDraft(containerId, 'exercise', exerciseId);
    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId, itemId: item.id };
  });
}
