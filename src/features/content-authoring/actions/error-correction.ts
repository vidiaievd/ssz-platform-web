'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  TEMPLATE_CODE,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/error-correction';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveErrorCorrectionInput {
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

export type SaveErrorCorrectionOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the error-correction builder.
 *
 * The same shape as `saveGapFillAction`, and for the same reason: the builder owns the
 * whole document, so there is nothing to merge with the generic exercise form, and the
 * write has to be conditional — `content` and `expected_answers` are both replaced
 * wholesale, and two authors saving in turn would otherwise erase each other silently.
 */
export async function saveErrorCorrectionAction(
  exerciseId: string,
  containerId: string,
  input: SaveErrorCorrectionInput,
): Promise<Result<SaveErrorCorrectionOutcome>> {
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

/** The id every scaffolded document starts its single item with. */
const SCAFFOLD_ITEM_ID = 'i1';

/**
 * The document a brand-new error correction starts as.
 *
 * A worked pair rather than two empty fields. The template's `contentSchema` requires an
 * item and its `answerSchema` requires a `ref`, so the exercise cannot be created empty —
 * and a pair that already derives one mistake shows the author what the two fields are
 * for better than a placeholder does. Norwegian, like every other template's scaffold:
 * this is course content, not interface copy, so it is not translated.
 */
function scaffoldContent(): PersistedContent {
  return {
    mode: 'sentences',
    note: '',
    items: [{ id: SCAFFOLD_ITEM_ID, wrong: 'I går jeg gikk på kino.' }],
    hints: { ...DEFAULT_HINTS },
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
  };
}

function scaffoldAnswers(): PersistedAnswers {
  return { items: { [SCAFFOLD_ITEM_ID]: { ref: 'I går gikk jeg på kino.', alts: [], meta: {} } } };
}

export async function createErrorCorrectionAction(
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
        expectedAnswers: scaffoldAnswers(),
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
