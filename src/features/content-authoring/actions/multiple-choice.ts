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
} from '@/lib/shared-kernel/multiple-choice';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

/**
 * The ids a brand-new set opens with.
 *
 * Fixed rather than minted: the kernel's factories draw from `Math.random` because they
 * also run in a service, and a scaffold built on a server has no reason to be random —
 * these ids only have to be unique inside their own document, which they are.
 */
const SCAFFOLD_QUESTION_ID = 'q1';
const SCAFFOLD_OPTION_IDS = ['o1', 'o2', 'o3'] as const;

export interface SaveMultipleChoiceInput {
  /**
   * The persisted document — the template's own shape, plus the audio block when the
   * exercise has one. The layer belongs to no template (plan 56), so the type says so
   * rather than pretending `PersistedContent` grew a field.
   */
  content: PersistedContent & Record<string, unknown>;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveMultipleChoiceOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the multiple-choice builder.
 *
 * The same shape as the seven before it, and for the same reason: the builder owns the
 * whole document, so there is nothing to merge with the generic exercise form, and the
 * write has to be conditional — both columns are replaced wholesale, and two authors
 * saving in turn would otherwise erase each other silently.
 *
 * Both columns go every time, and for this type that is not a precaution but the shape of
 * the document: which option is right is **only** in `expectedAnswers`, keyed by question
 * id and option id. A `content` written without it would leave the key pointing at options
 * that no longer exist, and the set would grade every pick wrong while looking correct on
 * screen.
 */
export async function saveMultipleChoiceAction(
  exerciseId: string,
  containerId: string,
  input: SaveMultipleChoiceInput,
): Promise<Result<SaveMultipleChoiceOutcome>> {
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
 * The document a brand-new multiple-choice exercise starts as: one grammar question with
 * three empty options and no key, exactly as `newQuestion()` defines it.
 *
 * Nothing here pretends the exercise is ready. No stem, no key and no rule are blockers
 * the gate reports from the first mount, and the rail's red badges on steps 1 and 4 are
 * how the author is told which screen answers them.
 *
 * The key column is written even though it holds nothing yet. An absent
 * `expectedAnswers.questions` would be read back as "this question's key was never
 * written", which is true — but the map is what every later save patches, and creating the
 * row without it makes the first save the one that invents the shape.
 *
 * The instruction arrives from the caller rather than from a constant here. The handoff's
 * `mcEmpty()` seeds «Velg det riktige svaret.», and a Norwegian literal baked into a
 * scaffold would be handed to the Ukrainian school and the English one alike (plan 53
 * §3.6, carried from plans 51 and 52). The picker passes the line in the author's own
 * locale.
 */
function scaffold(instruction: string): { content: PersistedContent; answers: PersistedAnswers } {
  return {
    content: {
      title: '',
      instruction,
      questions: [
        {
          id: SCAFFOLD_QUESTION_ID,
          kind: 'grammar',
          context: '',
          stem: '',
          options: SCAFFOLD_OPTION_IDS.map((id) => ({ id, text: '', fixed: false })),
        },
      ],
      settings: { ...DEFAULT_SETTINGS },
    },
    answers: {
      questions: {
        [SCAFFOLD_QUESTION_ID]: { correctOptionId: '', why: '', options: {} },
      },
    },
  };
}

/**
 * Create a `multiple_choice` exercise of the new form and file it in the module's draft.
 *
 * The scaffold is required rather than convenient, and for two reasons at once. The
 * template's content schema accepts a document with `questions` **or** with `question`
 * (plan 53 §7, phase 2) — so an exercise created without one would be written in the old
 * single-question shape by the generic form, and the builder, which dispatches on the
 * shape of the document, would never open for it. And a document with neither field is
 * refused outright, so a builder mounted on nothing could not save its way out.
 *
 * This is the eighth entry in `OWN_BUILDER_SCAFFOLDS` and the last of the thirteen
 * templates to get one: `multiple_choice` was the platform's default exercise type, which
 * is exactly why it was the one still being written in the generic form (plan 53 §8 Q5).
 */
export async function createMultipleChoiceAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);
    const { content, answers } = scaffold(instructions.trim());

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
