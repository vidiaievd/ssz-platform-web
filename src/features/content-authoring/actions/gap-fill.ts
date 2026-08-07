'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  DEFAULT_SETTINGS,
  TEMPLATE_CODE,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/wordbank-gapfill';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveGapFillInput {
  content: PersistedContent;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
  hint?: string;
}

export type SaveGapFillOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the gap-fill builder.
 *
 * Distinct from `updateExerciseAction` on purpose. That one takes the generic exercise
 * form, merges its output over the stored document to protect keys the form cannot
 * reach, and writes unconditionally. Here the builder owns the whole document — the
 * kernel produced both columns — so there is nothing to merge, and the write must be
 * conditional: `content` is replaced wholesale, and two authors saving in turn would
 * otherwise erase each other silently.
 */
export async function saveGapFillAction(
  exerciseId: string,
  containerId: string,
  input: SaveGapFillInput,
): Promise<Result<SaveGapFillOutcome>> {
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

    // The instruction row is separate storage and separate history: it has no bearing on
    // the exercise's `updatedAt`, so saving it cannot invalidate the token just returned.
    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}/instructions`,
      method: 'POST',
      body: {
        instructionLanguage: INSTRUCTION_LANGUAGE,
        instructionText: input.instructions.trim(),
        ...(input.hint?.trim() ? { hintText: input.hint.trim() } : {}),
      },
    });

    revalidatePath(`/school/content/${containerId}`);
    return ok({ status: 'saved', updatedAt });
  } catch (error) {
    if (isAppError(error) && error.code === 'conflict') {
      return ok({ status: 'conflict', currentUpdatedAt: readCurrentUpdatedAt(error.details) });
    }
    if (isAppError(error)) return err(error.toJSON());
    throw error;
  }
}

/** `{ message, currentUpdatedAt }` from content-service, defended against any other shape. */
function readCurrentUpdatedAt(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['currentUpdatedAt'];
  return typeof value === 'string' ? value : null;
}

/**
 * The document a brand-new gap-fill starts as.
 *
 * Not empty: the picker creates the exercise before the author has written anything,
 * and the template's `contentSchema` requires at least one sentence. So it starts as one
 * sentence with one gap already marked — structurally valid, and a working example of
 * what the author is about to replace. The wording is deliberately untranslated, like
 * every other template's scaffold: it is course content in the language being taught.
 */
function scaffoldContent(): PersistedContent {
  return {
    sentences: [{ id: 's1', text: 'Skriv en setning med et ord som skal fylles inn.', gaps: [5] }],
    distractors: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export async function createGapFillAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);

    const { exerciseId } = await serverFetch<{ exerciseId: string }>({
      service: 'content',
      path: '/exercises',
      method: 'POST',
      body: {
        exerciseTemplateId,
        targetLanguage,
        difficultyLevel,
        content: scaffoldContent(),
        // A gap with no explanation yet: `FB_NO_FALLBACK` is exactly the blocker step 3
        // exists to clear, and starting green would hide the work still to do.
        expectedAnswers: { feedback: {} } satisfies PersistedAnswers,
        visibility,
        ...(ownerSchoolId && { ownerSchoolId }),
      },
    });

    const item = await addItemToDraft(containerId, 'exercise', exerciseId);
    // Required: an exercise without an instruction row cannot be published.
    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}/instructions`,
      method: 'POST',
      body: { instructionLanguage: INSTRUCTION_LANGUAGE, instructionText: instructions },
    });

    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId, itemId: item.id };
  });
}
