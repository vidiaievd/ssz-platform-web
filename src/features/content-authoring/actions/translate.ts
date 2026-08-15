'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_LANGS,
  type PersistedAnswers,
  type PersistedContent,
  type TranslateType,
} from '@/lib/shared-kernel/translate';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

export interface SaveTranslateInput {
  content: PersistedContent;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveTranslateOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the translate builder.
 *
 * The same shape as `saveErrorCorrectionAction`, for the same reason: the builder owns
 * the whole document, both JSON columns are replaced wholesale, and two authors saving in
 * turn would otherwise erase each other in silence.
 *
 * The stored template code is not written here and cannot be: the row's template is fixed
 * when the exercise is created, while `content.dir` is the author's to change afterwards.
 * That is by design (plan 42, decision 3) — everything that plays the exercise reads the
 * direction out of `content`, and the code only decides which of the two catalogue entries
 * the exercise files under.
 */
export async function saveTranslateAction(
  exerciseId: string,
  containerId: string,
  input: SaveTranslateInput,
): Promise<Result<SaveTranslateOutcome>> {
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

/** The id every scaffolded document starts its single sentence with. */
const SCAFFOLD_ITEM_ID = 'i1';

/**
 * The document a brand-new translate exercise starts as.
 *
 * A worked pair rather than two empty fields, like every other builder's scaffold: the
 * template's `contentSchema` needs an item and its `answerSchema` needs a `ref`, so the
 * exercise cannot be created empty — and a sentence that already has an accepted
 * translation with an inline alternative shows what the second field is for better than a
 * placeholder does. Norwegian and Russian, because this is course content rather than
 * interface copy, and so is not translated.
 */
function scaffoldContent(dir: 'to_target' | 'from_target'): PersistedContent {
  return {
    dir,
    langs: { ...DEFAULT_LANGS },
    format: 'set',
    note: '',
    items: [
      {
        id: SCAFFOLD_ITEM_ID,
        dir,
        source:
          dir === 'to_target' ? 'Я живу в Тромсё три года.' : 'Jeg har bodd i Tromsø i tre år.',
        gloss: [],
      },
    ],
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
  };
}

function scaffoldAnswers(dir: 'to_target' | 'from_target'): PersistedAnswers {
  return {
    items: {
      [SCAFFOLD_ITEM_ID]: {
        refs: [
          dir === 'to_target'
            ? 'Jeg (har bodd|bodde) i Tromsø i tre år.'
            : 'Я (живу|прожил) в Тромсё три года.',
        ],
        require: [],
        forbid: [],
      },
    },
  };
}

async function createTranslateExercise(
  code: TranslateType,
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  const dir = code === 'translate_from_target' ? 'from_target' : 'to_target';

  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(code);

    const { exerciseId } = await serverFetch<{ exerciseId: string }>({
      service: 'content',
      path: '/exercises',
      method: 'POST',
      body: {
        exerciseTemplateId,
        targetLanguage,
        difficultyLevel,
        content: scaffoldContent(dir),
        expectedAnswers: scaffoldAnswers(dir),
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

/**
 * Two actions rather than one with a direction argument, because the picker offers the two
 * catalogue entries and a scaffold has to know which way round its worked pair reads.
 */
export async function createTranslateToTargetAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return createTranslateExercise(
    'translate_to_target',
    containerId,
    targetLanguage,
    difficultyLevel,
    visibility,
    instructions,
    ownerSchoolId,
  );
}

export async function createTranslateFromTargetAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return createTranslateExercise(
    'translate_from_target',
    containerId,
    targetLanguage,
    difficultyLevel,
    visibility,
    instructions,
    ownerSchoolId,
  );
}
