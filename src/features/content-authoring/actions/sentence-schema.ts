'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  emptyContent,
  preset,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/sentence-schema';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

/**
 * The pack a new exercise is seeded from — the full Norwegian sentence chart, as the
 * handoff's own `ssEmpty()` does.
 *
 * A seed, not a commitment: step 1 replaces it with one click, and `presetId` is
 * provenance rather than a key (the schema in the document is authoritative). The type
 * stays language-agnostic because the field set is data; which four fields a blank
 * document opens with is a convenience, not a property of the runtime.
 */
const STARTER_PRESET = 'nb-full';

export interface SaveSentenceSchemaInput {
  content: PersistedContent;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveSentenceSchemaOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the sentence-schema builder.
 *
 * The same shape as the six before it, and for the same reason: the builder owns the whole
 * document, so there is nothing to merge with the generic exercise form, and the write has
 * to be conditional — both columns are replaced wholesale, and two authors saving in turn
 * would otherwise erase each other silently.
 *
 * Both columns go every time, and here they are more literally two halves of one document
 * than anywhere else: `expectedAnswers` is keyed by row id and by chunk id inside it, so a
 * `content` written without it would leave the key pointing at pieces that no longer exist
 * — which is the one failure this type cannot survive, because the key *is* the bank.
 */
export async function saveSentenceSchemaAction(
  exerciseId: string,
  containerId: string,
  input: SaveSentenceSchemaInput,
): Promise<Result<SaveSentenceSchemaOutcome>> {
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
 * The document a brand-new sentence-schema exercise starts as.
 *
 * The full Norwegian chart on the main clause, one clause type switched on, and one blank
 * sentence. Nothing here pretends the exercise is ready: an empty sentence, no placements
 * and no rule are blockers the gate reports from the first mount, which is what the step-2
 * and step-4 dots are for.
 *
 * The instruction arrives from the caller rather than from a constant here. The handoff's
 * `ssEmpty()` seeds `"Legg ordene i riktig felt."`, and a Norwegian literal baked into a
 * scaffold would be handed to the Ukrainian school and the English one alike (plan 51 §5,
 * repeated in plan 52 §5). The picker passes the line in the author's own locale.
 */
function scaffold(instruction: string): { content: PersistedContent; answers: PersistedAnswers } {
  const document = {
    ...emptyContent(preset(STARTER_PRESET).build(), STARTER_PRESET),
    instruction,
  };
  return { content: toContent(document), answers: toExpectedAnswers(document) };
}

/**
 * Create a `sentence_schema` exercise and file it in the module's draft.
 *
 * Every exercise of this type is of this form — plan 52 §8 Q7 removed the old one from the
 * catalogue entirely, so unlike `short_answer` there is no second shape to dispatch on.
 * The scaffold is still required rather than optional: the template's content schema wants
 * `rows`, and the generic exercise form has no way to write one.
 */
export async function createSentenceSchemaAction(
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
