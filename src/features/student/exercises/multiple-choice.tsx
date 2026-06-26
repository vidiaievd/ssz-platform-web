'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { ExerciseDisplay } from '@/features/content/types';
import { submitAttemptAction } from '../actions/submit-attempt';
import type { AttemptResult } from '../types/exercise';
import { FeedbackPanel } from './feedback-panel';

interface MultipleChoiceExerciseProps {
  exercise: ExerciseDisplay;
}

export function MultipleChoiceExercise({ exercise }: MultipleChoiceExerciseProps) {
  const t = useTranslations('Exercise');
  const tErrors = useTranslations('Errors');
  const content = exercise.content;

  const question = typeof content.question === 'string' ? content.question : '';
  const options = Array.isArray(content.options) ? (content.options as string[]) : [];
  const correctIndex = typeof content.correctIndex === 'number' ? content.correctIndex : -1;

  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const startedAtRef = useRef(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  function handleSubmit() {
    if (selected === null) return;
    startTransition(async () => {
      const res = await submitAttemptAction({
        exerciseId: exercise.id,
        type: 'multiple_choice',
        answer: selected,
        timeSpentSeconds: (Date.now() - startedAtRef.current) / 1000,
      });
      if (!res.ok) {
        toast.error(tErrors(res.error.code));
        return;
      }
      setResult(res.value);
    });
  }

  function handleRetry() {
    setSelected(null);
    setResult(null);
    startedAtRef.current = Date.now();
  }

  const isSubmitted = result !== null;

  function optionStyle(index: number) {
    const base =
      'w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
    if (!isSubmitted) {
      return selected === index
        ? `${base} border-primary bg-primary/10 font-medium`
        : `${base} border-border bg-card hover:bg-muted`;
    }
    if (index === correctIndex) return `${base} border-green-500 bg-green-50 dark:bg-green-950/30 font-medium`;
    if (index === selected && index !== correctIndex)
      return `${base} border-red-500 bg-red-50 dark:bg-red-950/30`;
    return `${base} border-border bg-card opacity-60`;
  }

  return (
    <div className="space-y-4">
      {exercise.instructions && (
        <p className="text-muted-foreground text-sm">{exercise.instructions}</p>
      )}

      <p className="text-base font-medium">{question}</p>

      <div className="space-y-2" role="radiogroup" aria-label={t('mc.optionsLabel')}>
        {options.map((option, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={selected === i}
            className={optionStyle(i)}
            onClick={() => !isSubmitted && setSelected(i)}
            disabled={isSubmitted || isPending}
          >
            <span className="mr-3 font-mono text-muted-foreground">
              {String.fromCharCode(65 + i)}.
            </span>
            {option}
          </button>
        ))}
      </div>

      {!isSubmitted && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          loading={isPending}
          disabled={selected === null || isPending}
        >
          {t('submit')}
        </Button>
      )}

      {result && <FeedbackPanel result={result} onRetry={handleRetry} />}
    </div>
  );
}
