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
} from '@/lib/shared-kernel/short-answer';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveShortAnswerInput {
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

export type SaveShortAnswerOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the short-answer builder.
 *
 * The same shape as the five before it, and for the same reason: the builder owns the
 * whole document, so there is nothing to merge with the generic exercise form, and the
 * write has to be conditional — both columns are replaced wholesale, and two authors
 * saving in turn would otherwise erase each other silently.
 *
 * Both columns go every time. They are two halves of one document here more literally
 * than anywhere else: `expectedAnswers` is keyed by question id, so a `content` written
 * without it would leave the key pointing at questions that no longer exist.
 */
export async function saveShortAnswerAction(
  exerciseId: string,
  containerId: string,
  input: SaveShortAnswerInput,
): Promise<Result<SaveShortAnswerOutcome>> {
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

/** The id the one scaffolded question carries in both columns, and its one element. */
const SCAFFOLD_QUESTION_ID = 'q1';
const SCAFFOLD_ELEMENT_ID = 'e1';

/**
 * The document a brand-new short answer starts as.
 *
 * One `reading` question with nothing written in it, one empty key element, and the
 * handoff's default settings. Nothing here pretends the exercise is ready: an empty
 * prompt, an empty model answer and an unusable element are blockers the gate reports
 * from the first mount, which is what the step-1 and step-2 dots are for.
 *
 * The instruction is the one field that arrives filled in, and it arrives from the
 * caller rather than from a constant here. Plan 51 §5: the prototype's `saEmpty()` seeds
 * a Norwegian sentence, and a Norwegian literal baked into a scaffold would be handed to
 * the Ukrainian school and the English one alike. The picker passes the line in the
 * author's own locale, which is the same string the platform writes onto every other new
 * exercise's instruction row.
 */
function scaffold(instruction: string): { content: PersistedContent; answers: PersistedAnswers } {
  return {
    content: {
      title: '',
      instruction,
      questions: [{ id: SCAFFOLD_QUESTION_ID, kind: 'reading', passage: '', prompt: '' }],
      settings: { ...DEFAULT_SETTINGS },
    },
    answers: {
      questions: {
        [SCAFFOLD_QUESTION_ID]: {
          elements: [{ id: SCAFFOLD_ELEMENT_ID, label: '', anchors: [], required: true }],
          model: '',
          why: '',
        },
      },
    },
  };
}

/**
 * Create a `short_answer` exercise of the new form and file it in the module's draft.
 *
 * Every exercise created from here is of the new form, and that is the decision plan 51
 * §8 Q1 made: the 144 documents of the old form stay live and keep opening in the generic
 * exercise form, but nothing new is written that way. The editor pane dispatches on the
 * document's shape, not on the template code, so the two go on living side by side.
 */
export async function createShortAnswerAction(
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
