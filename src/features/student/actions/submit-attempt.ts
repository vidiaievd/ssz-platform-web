'use server';

import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { AttemptResult, SubmitAttemptInput } from '../types/exercise';

function scoreStrings(userAnswers: string[], correct: string[]): AttemptResult {
  const results = userAnswers.map((a, i) =>
    a.trim().toLowerCase() === (correct[i] ?? '').toLowerCase(),
  );
  const correctCount = results.filter(Boolean).length;

  if (correctCount === correct.length) {
    return { verdict: 'correct', canRetry: false };
  }
  if (correctCount > 0) {
    return {
      verdict: 'partial',
      correctAnswer: correct,
      canRetry: true,
    };
  }
  return { verdict: 'incorrect', correctAnswer: correct, canRetry: true };
}

export async function submitAttemptAction(input: SubmitAttemptInput) {
  return tryAction<AttemptResult>(async () => {
    const { type, answer, content } = input;

    // Stub implementation — scores locally against the exercise content.
    // Production: replace body with serverFetch({ service: 'progress', path: `/api/v1/exercises/${input.exerciseId}/attempts`, method: 'POST', body: { answer } })
    // and remove the `content` field from SubmitAttemptInput.

    switch (type) {
      case 'cloze': {
        if (!Array.isArray(answer)) throw new AppError('validation', 'Invalid answer format');
        const correct = Array.isArray(content.answers) ? (content.answers as string[]) : [];
        return scoreStrings(answer as string[], correct);
      }

      case 'multiple_choice': {
        if (typeof answer !== 'number') throw new AppError('validation', 'Invalid answer format');
        const correctIndex = typeof content.correctIndex === 'number' ? content.correctIndex : -1;
        const options = Array.isArray(content.options) ? (content.options as string[]) : [];
        const isCorrect = answer === correctIndex;
        return {
          verdict: isCorrect ? 'correct' : 'incorrect',
          correctAnswer: options[correctIndex] ?? String(correctIndex),
          explanation:
            typeof content.explanation === 'string' ? content.explanation : undefined,
          canRetry: !isCorrect,
        };
      }

      case 'free_text': {
        const sampleAnswer =
          typeof content.sampleAnswer === 'string' ? content.sampleAnswer : undefined;
        return {
          verdict: 'partial',
          correctAnswer: sampleAnswer,
          canRetry: true,
        };
      }

      case 'pronunciation':
        throw new AppError('validation', 'Pronunciation exercises are handled in VoxOrd');

      default:
        throw new AppError('validation', 'Unknown exercise type');
    }
  });
}
