'use server';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { AttemptResult, SubmitAttemptInput } from '../types/exercise';

const StartAttemptResponse = z.object({
  attemptId: z.string(),
});

const SubmitAnswerResponse = z.object({
  verdict: z.enum(['correct', 'partial', 'incorrect']),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  explanation: z.string().optional(),
  requiresReview: z.boolean().optional(),
});

export async function submitAttemptAction(input: SubmitAttemptInput) {
  return tryAction<AttemptResult>(async () => {
    if (input.type === 'pronunciation') {
      throw new AppError('validation', 'Pronunciation exercises are handled in VoxOrd');
    }

    // 1. Start attempt — get an attemptId from the Exercise Engine.
    const startRaw = await serverFetch({
      service: 'exercises',
      path: `/api/v1/exercises/${input.exerciseId}/attempts`,
      method: 'POST',
    });

    const startParsed = StartAttemptResponse.safeParse(startRaw);
    if (!startParsed.success) {
      throw new AppError('unknown', 'Unexpected response from Exercise Engine (start)');
    }
    const { attemptId } = startParsed.data;

    // 2. Submit the answer.
    const submitRaw = await serverFetch({
      service: 'exercises',
      path: `/api/v1/exercises/${input.exerciseId}/attempts/${attemptId}/submit`,
      method: 'POST',
      body: { answer: input.answer },
    });

    const submitParsed = SubmitAnswerResponse.safeParse(submitRaw);
    if (!submitParsed.success) {
      throw new AppError('unknown', 'Unexpected response from Exercise Engine (submit)');
    }

    const { verdict, correctAnswer, explanation, requiresReview } = submitParsed.data;

    return {
      verdict,
      correctAnswer,
      explanation,
      requiresReview,
      canRetry: verdict !== 'correct' && !requiresReview,
    };
  });
}
