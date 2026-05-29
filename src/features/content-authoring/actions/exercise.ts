'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { ExerciseDisplay } from '@/features/content/types';

import { exerciseFormSchema, type ExerciseFormValues } from '../schemas/exercise';

function buildContent(data: ExerciseFormValues): Record<string, unknown> {
  switch (data.templateCode) {
    case 'cloze':
      return {
        template: data.clozeTemplate ?? '',
        blanks: (data.clozeAnswers ?? []).map((a) => ({ answer: a.text })),
      };
    case 'multiple_choice':
      return {
        question: data.mcQuestion ?? '',
        options: (data.mcOptions ?? []).map((o) => o.text),
        correctIndex: data.mcCorrectIndex ?? 0,
      };
    case 'free_text':
      return {
        prompt: data.ftPrompt ?? '',
        ...(data.ftSampleAnswer && { sampleAnswer: data.ftSampleAnswer }),
      };
    case 'pronunciation':
      return {
        text: data.pronText ?? '',
        ...(data.pronIpa && { ipa: data.pronIpa }),
      };
  }
}

export async function createExerciseAction(
  containerId: string,
  targetLanguage: string,
  data: ExerciseFormValues,
) {
  return tryAction(async () => {
    const parsed = exerciseFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const exercise = await serverFetch<ExerciseDisplay>({
      service: 'content',
      path: '/exercises',
      method: 'POST',
      body: {
        containerId,
        targetLanguage,
        templateCode: parsed.data.templateCode,
        content: buildContent(parsed.data),
        ...(parsed.data.instructions && { instructions: parsed.data.instructions }),
        ...(parsed.data.difficultyLevel && { difficultyLevel: parsed.data.difficultyLevel }),
      },
    });

    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId: exercise.id };
  });
}

export async function updateExerciseAction(
  exerciseId: string,
  containerId: string,
  data: ExerciseFormValues,
) {
  return tryAction(async () => {
    const parsed = exerciseFormSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}`,
      method: 'PATCH',
      body: {
        content: buildContent(parsed.data),
        instructions: parsed.data.instructions ?? null,
        ...(parsed.data.difficultyLevel && { difficultyLevel: parsed.data.difficultyLevel }),
      },
    });

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
