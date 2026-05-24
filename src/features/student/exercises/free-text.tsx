'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ExerciseDisplay } from '@/features/content/types';
import { submitAttemptAction } from '../actions/submit-attempt';
import type { AttemptResult } from '../types/exercise';
import { FeedbackPanel } from './feedback-panel';

interface FreeTextExerciseProps {
  exercise: ExerciseDisplay;
}

export function FreeTextExercise({ exercise }: FreeTextExerciseProps) {
  const t = useTranslations('Exercise');
  const tErrors = useTranslations('Errors');
  const content = exercise.content;

  const prompt = typeof content.prompt === 'string' ? content.prompt : '';
  const hints = Array.isArray(content.hints) ? (content.hints as string[]) : [];

  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!answer.trim()) return;
    startTransition(async () => {
      const res = await submitAttemptAction({
        exerciseId: exercise.id,
        type: 'free_text',
        answer,
      });
      if (!res.ok) {
        toast.error(tErrors(res.error.code));
        return;
      }
      setResult(res.value);
    });
  }

  function handleRetry() {
    setAnswer('');
    setResult(null);
  }

  const isSubmitted = result !== null;

  return (
    <div className="space-y-4">
      {exercise.instructions && (
        <p className="text-muted-foreground text-sm">{exercise.instructions}</p>
      )}

      <p className="text-base font-medium">{prompt}</p>

      {hints.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {hints.map((hint, i) => (
            <li key={i} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {hint}
            </li>
          ))}
        </ul>
      )}

      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={t('freeText.placeholder')}
        rows={4}
        disabled={isSubmitted || isPending}
        aria-label={t('freeText.ariaLabel')}
      />

      {!isSubmitted && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          loading={isPending}
          disabled={!answer.trim() || isPending}
        >
          {t('submit')}
        </Button>
      )}

      {result && <FeedbackPanel result={result} onRetry={handleRetry} />}
    </div>
  );
}
