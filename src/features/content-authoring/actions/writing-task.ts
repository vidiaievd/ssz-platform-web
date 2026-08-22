'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  defaultRubric,
  DEFAULT_AI,
  DEFAULT_SETTINGS,
  LEN_DEFAULTS,
  TEMPLATE_CODE,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/writing-task';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

/** The id the one scaffolded must-cover point carries in both columns. */
const SCAFFOLD_POINT_ID = 'p1';

export interface SaveWritingTaskInput {
  content: PersistedContent;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveWritingTaskOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the writing-task builder.
 *
 * The same shape as the four before it, and for the same reason: the builder owns the
 * whole document, so there is nothing to merge with the generic exercise form, and the
 * write has to be conditional — both columns are replaced wholesale, and two authors
 * saving in turn would otherwise erase each other silently.
 */
export async function saveWritingTaskAction(
  exerciseId: string,
  containerId: string,
  input: SaveWritingTaskInput,
): Promise<Result<SaveWritingTaskOutcome>> {
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

/**
 * The document a brand-new writing task starts as.
 *
 * A `letter` with an empty prompt and one empty point, and the four-criterion default
 * rubric already in place. The two halves are deliberately different: the prompt and the
 * point are the author's subject and nobody can guess them, while a rubric is the same
 * four questions in almost every writing task and starting from a blank one costs the
 * author twenty fields before they have written a word. Both are editable; only the
 * rubric arrives already worth reading.
 *
 * Nothing here pretends the exercise is ready: an empty prompt and an empty point are
 * blockers the gate reports from the first mount, which is what the step-1 dot is for.
 *
 * The two columns are built from one `defaultRubric()` call, because they are keyed by
 * criterion id — two calls would hand every criterion a set of descriptors belonging to
 * nobody. Norwegian, like every other template's scaffold: this is course content, not
 * interface copy, so it is not translated.
 */
function scaffold(): { content: PersistedContent; answers: PersistedAnswers } {
  const [minWords, maxWords] = LEN_DEFAULTS.letter;
  const rubric = defaultRubric();

  const content: PersistedContent = {
    mode: 'letter',
    instruction: 'Skriv en sammenhengende tekst.',
    prompt: '',
    source: '',
    image: { caption: '', alt: '' },
    letter: { register: 'formal', recipient: '' },
    points: [{ id: SCAFFOLD_POINT_ID, text: '', required: true }],
    phrases: [],
    rubric: rubric.map((c) => ({
      id: c.id,
      name: c.name,
      desc: c.desc,
      weight: c.weight,
      metric: c.metric,
    })),
    settings: { ...DEFAULT_SETTINGS, minWords, maxWords, ai: { ...DEFAULT_AI } },
  };

  const answers: PersistedAnswers = {
    points: { [SCAFFOLD_POINT_ID]: { keywords: [] } },
    rubric: Object.fromEntries(rubric.map((c) => [c.id, { levels: c.levels }])),
    model: '',
  };

  return { content, answers };
}

export async function createWritingTaskAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);
    const { content, answers } = scaffold();

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
