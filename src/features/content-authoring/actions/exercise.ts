'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { DifficultyLevel, ExerciseWithAnswers, Visibility } from '@/features/content/types';

import { exerciseFormSchema, type ExerciseFormValues } from '../schemas/exercise';
import { buildExercisePayload } from '../lib/exercise-content';
import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

function parseOrThrow(data: ExerciseFormValues) {
  const parsed = exerciseFormSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(
      'validation',
      'Invalid input',
      parsed.error.flatten((i) => i.message),
    );
  }
  return parsed.data;
}

// Instructions are authored in the explanation language ('en', matching lesson
// variants). The backend endpoint upserts per language and requires a non-empty
// instructionText, so a hint-only entry can't be persisted on its own.
const INSTRUCTION_LANGUAGE = 'en';

async function upsertInstruction(exerciseId: string, instructionText: string, hintText?: string) {
  await serverFetch({
    service: 'content',
    path: `/exercises/${exerciseId}/instructions`,
    method: 'POST',
    body: {
      instructionLanguage: INSTRUCTION_LANGUAGE,
      instructionText,
      ...(hintText?.trim() && { hintText: hintText.trim() }),
    },
  });
}

/**
 * Creates an exercise and attaches it to the container's draft version.
 *
 * `POST /exercises` needs the template UUID (`exerciseTemplateId`) plus separate
 * `content` / `expectedAnswers` objects conforming to the template schemas, and
 * does NOT attach to a container — so we resolve the template, build the two
 * payloads, then attach with a follow-up `addItemToDraft` (like lesson/vocab).
 */
export async function createExerciseAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  data: ExerciseFormValues,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const parsed = parseOrThrow(data);
    const exerciseTemplateId = await resolveExerciseTemplateId(parsed.templateCode);
    const { content, expectedAnswers } = buildExercisePayload(parsed);

    const { exerciseId } = await serverFetch<{ exerciseId: string }>({
      service: 'content',
      path: '/exercises',
      method: 'POST',
      body: {
        exerciseTemplateId,
        targetLanguage,
        difficultyLevel: parsed.difficultyLevel ?? difficultyLevel,
        content,
        expectedAnswers,
        visibility,
        // Without the owning school, `school_private` is rejected as a
        // visibility no ownerless material may have (content-service
        // `getValidVisibilities`).
        ...(ownerSchoolId && { ownerSchoolId }),
      },
    });

    const item = await addItemToDraft(containerId, 'exercise', exerciseId);

    // Unconditional: the schema requires instructions, because an exercise
    // without an instruction row is a publish blocker (`EXERCISE_INCOMPLETE`).
    await upsertInstruction(exerciseId, parsed.instructions.trim(), parsed.hint);

    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId, itemId: item.id };
  });
}

export async function updateExerciseAction(
  exerciseId: string,
  containerId: string,
  data: ExerciseFormValues,
) {
  return tryAction(async () => {
    const parsed = parseOrThrow(data);

    // Read before write: the form models only part of each template's schema,
    // and `PATCH` replaces `content` / `expectedAnswers` wholesale. Merging over
    // the stored exercise is what keeps the keys the form cannot reach — see
    // `buildExercisePayload`.
    const current = await serverFetch<ExerciseWithAnswers>({
      service: 'content',
      path: `/exercises/${exerciseId}/answers`,
    });
    const { content, expectedAnswers } = buildExercisePayload(parsed, current);

    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}`,
      method: 'PATCH',
      body: {
        content,
        expectedAnswers,
        ...(parsed.difficultyLevel && { difficultyLevel: parsed.difficultyLevel }),
      },
    });

    // Unconditional: the schema requires instructions, because an exercise
    // without an instruction row is a publish blocker (`EXERCISE_INCOMPLETE`).
    await upsertInstruction(exerciseId, parsed.instructions.trim(), parsed.hint);

    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function deleteExerciseAction(exerciseId: string, containerId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}`,
      method: 'DELETE',
    });
    revalidatePath(`/school/content/${containerId}`);
  });
}
