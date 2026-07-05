'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { ExerciseDisplay } from '@/features/content/types';
import { submitAttemptAction } from '../actions/submit-attempt';
import type { AttemptResult } from '../types/exercise';
import { FeedbackPanel } from './feedback-panel';

interface ClozeExerciseProps {
  exercise: ExerciseDisplay;
}

const BLANK_MARKER = '___';

function parseTemplate(template: string): string[] {
  return template.split(BLANK_MARKER);
}

export function ClozeExercise({ exercise }: ClozeExerciseProps) {
  const t = useTranslations('Exercise');
  const tErrors = useTranslations('Errors');
  const content = exercise.content;

  const template = typeof content.template === 'string' ? content.template : '';
  const hints = Array.isArray(content.hints) ? (content.hints as string[]) : [];
  const segments = parseTemplate(template);
  const blankCount = segments.length - 1;

  const [answers, setAnswers] = useState<string[]>(() => Array(blankCount).fill(''));
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const startedAtRef = useRef(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  function handleSubmit() {
    if (answers.some((a) => !a.trim())) return;
    startTransition(async () => {
      const res = await submitAttemptAction({
        exerciseId: exercise.id,
        type: 'cloze',
        answer: answers,
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
    setAnswers(Array(blankCount).fill(''));
    setResult(null);
    startedAtRef.current = Date.now();
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }

  const isSubmitted = result !== null;
  const allFilled = answers.every((a) => a.trim());

  return (
    <div className="space-y-4">
      {exercise.instructions && (
        <p className="text-muted-foreground text-sm">{exercise.instructions}</p>
      )}

      <div
        className="rounded-lg border border-border bg-card p-4 text-base leading-loose"
        aria-label={t('cloze.ariaLabel')}
      >
        {segments.map((segment, i) => (
          <span key={i}>
            {segment}
            {i < blankCount && (
              <input
                ref={i === 0 ? firstInputRef : undefined}
                type="text"
                value={answers[i] ?? ''}
                onChange={(e) => updateAnswer(i, e.target.value)}
                disabled={isSubmitted || isPending}
                aria-label={t('cloze.blankLabel', { n: i + 1 })}
                className={[
                  'mx-1 inline-block w-28 rounded border px-2 py-0.5 text-center text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'disabled:cursor-not-allowed',
                  isSubmitted && result
                    ? answers[i]?.trim().toLowerCase() ===
                      (
                        Array.isArray(content.answers)
                          ? (content.answers as string[])[i]
                          : ''
                      )?.toLowerCase()
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                      : 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-border bg-background',
                ].join(' ')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && allFilled && !isSubmitted) handleSubmit();
                }}
              />
            )}
          </span>
        ))}
      </div>

      {hints.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {hints.map((hint, i) => (
            <li
              key={i}
              className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            >
              {hint}
            </li>
          ))}
        </ul>
      )}

      {!isSubmitted && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          loading={isPending}
          disabled={!allFilled || isPending}
        >
          {t('submit')}
        </Button>
      )}

      {result && <FeedbackPanel result={result} onRetry={handleRetry} />}
    </div>
  );
}
