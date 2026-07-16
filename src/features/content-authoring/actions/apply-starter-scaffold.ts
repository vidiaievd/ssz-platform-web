'use server';

import { revalidatePath } from 'next/cache';

import { AppError, type SerializedAppError } from '@/lib/errors';
import { tryAction, type Result } from '@/lib/result';
import type { AccessTier, DifficultyLevel, Visibility } from '@/features/content/types';

import { createModuleAction } from './container';
import { createLessonAction } from './lesson';
import { createVocabularyListAction } from './vocabulary';
import { createExerciseAction } from './exercise';
import { exerciseFormSchema } from '../schemas/exercise';

export interface CefrStarterTitles {
  module: string;
  vocabulary: string;
  reading: string;
  listening: string;
  practice: string;
}

/** Re-throws a failed nested Result's error so the outer `tryAction` serializes it correctly. */
function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  const { code, message, details } = result.error as SerializedAppError;
  throw new AppError(code, message, details);
}

/**
 * Seeds a freshly-created course with one A1 module containing a vocabulary
 * list, a reading (text) lesson, a listening (audio) lesson, and a practice
 * exercise — the "CEFR A1 starter" option in the create-course flow.
 */
export async function applyCefrStarterScaffoldAction(
  courseContainerId: string,
  targetLanguage: string,
  visibility: Visibility,
  accessTier: AccessTier,
  levelSectionId: string | null,
  titles: CefrStarterTitles,
) {
  return tryAction(async () => {
    const difficultyLevel: DifficultyLevel = 'A1';

    const { moduleContainerId } = unwrap(
      await createModuleAction(
        courseContainerId,
        titles.module,
        targetLanguage,
        difficultyLevel,
        visibility,
        accessTier,
        levelSectionId,
      ),
    );

    unwrap(
      await createVocabularyListAction(moduleContainerId, targetLanguage, difficultyLevel, visibility, {
        title: titles.vocabulary,
      }),
    );

    unwrap(
      await createLessonAction(
        moduleContainerId,
        targetLanguage,
        difficultyLevel,
        visibility,
        { title: titles.reading },
        'text',
      ),
    );

    unwrap(
      await createLessonAction(
        moduleContainerId,
        targetLanguage,
        difficultyLevel,
        visibility,
        { title: titles.listening },
        'audio',
      ),
    );

    const practiceDraft = exerciseFormSchema.parse({
      templateCode: 'multiple_choice',
      mcQuestion: titles.practice,
      mcOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
      mcCorrectIndex: 0,
    });
    unwrap(await createExerciseAction(moduleContainerId, targetLanguage, practiceDraft));

    revalidatePath(`/school/content/${courseContainerId}`);
    return { moduleContainerId };
  });
}
