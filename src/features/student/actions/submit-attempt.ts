'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { AttemptResult, AttemptVerdict, SubmitAttemptInput } from '../types/exercise';

const StartAttemptResponse = z.object({
  attemptId: z.string(),
});

const SubmitAnswerResponse = z.object({
  correct: z.boolean(),
  score: z.number().nullable().optional(),
  requiresReview: z.boolean(),
  feedback: z.object({
    summary: z.string(),
    hints: z.array(z.string()).optional(),
    correctAnswer: z.unknown().optional(),
  }),
});

function toVerdict(correct: boolean, requiresReview: boolean): AttemptVerdict {
  if (correct) return 'correct';
  // Not yet known to be right or wrong — a human still has to grade it.
  if (requiresReview) return 'partial';
  return 'incorrect';
}

function toCorrectAnswer(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value;
  return undefined;
}

export async function submitAttemptAction(input: SubmitAttemptInput) {
  return tryAction<AttemptResult>(async () => {
    if (input.type === 'pronunciation') {
      throw new AppError('validation', 'Pronunciation exercises are handled in VoxOrd');
    }

    const locale = await getLocale();

    // 1. Start attempt — get an attemptId from the Exercise Engine.
    const startRaw = await serverFetch({
      service: 'exercises',
      path: `/exercises/${input.exerciseId}/attempts`,
      method: 'POST',
      body: { language: locale, assignmentId: input.assignmentId },
    });

    const startParsed = StartAttemptResponse.safeParse(startRaw);
    if (!startParsed.success) {
      throw new AppError('unknown', 'Unexpected response from Exercise Engine (start)');
    }
    const { attemptId } = startParsed.data;

    // 2. Submit the answer.
    const submitRaw = await serverFetch({
      service: 'exercises',
      path: `/exercises/${input.exerciseId}/attempts/${attemptId}/submit`,
      method: 'POST',
      body: {
        submittedAnswer: input.answer,
        timeSpentSeconds: Math.max(0, Math.round(input.timeSpentSeconds)),
        locale,
      },
    });

    const submitParsed = SubmitAnswerResponse.safeParse(submitRaw);
    if (!submitParsed.success) {
      throw new AppError('unknown', 'Unexpected response from Exercise Engine (submit)');
    }

    const { correct, requiresReview, feedback } = submitParsed.data;
    const verdict = toVerdict(correct, requiresReview);

    return {
      verdict,
      correctAnswer: toCorrectAnswer(feedback.correctAnswer),
      explanation: feedback.summary,
      requiresReview,
      canRetry: verdict !== 'correct' && !requiresReview,
    };
  });
}
