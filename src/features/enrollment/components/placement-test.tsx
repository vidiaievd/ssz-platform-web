'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { scoreToCefr } from '../lib/score-to-cefr';
import type { CEFR } from '@/features/groups/types';
import type { LangCode } from '@/features/groups/types';

export interface PlacementQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
  correctId: string;
  weight: number;
}

type Props = {
  language: LangCode;
  questions: PlacementQuestion[];
  /** Called with the final score (0-100) and derived CEFR when the test is complete. */
  onComplete: (result: { score: number; cefrLevel: CEFR }) => void | Promise<void>;
};

export function PlacementTest({ language: _language, questions, onComplete }: Props) {
  const t = useTranslations('Enrollment.PlacementTest');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const question = questions[current];
  const isLast = current === questions.length - 1;
  const progress = Math.round(((current) / questions.length) * 100);

  function handleAnswer(optionId: string) {
    setSelected(optionId);
  }

  async function handleNext() {
    if (!selected || !question) return;

    const updated = { ...answers, [question.id]: selected };
    setAnswers(updated);
    setSelected(null);

    if (!isLast) {
      setCurrent((c) => c + 1);
      return;
    }

    // Compute score
    setSubmitting(true);
    const totalWeight = questions.reduce((s, q) => s + q.weight, 0);
    const earnedWeight = questions.reduce((s, q) => {
      return s + (updated[q.id] === q.correctId ? q.weight : 0);
    }, 0);
    const score = Math.round((earnedWeight / totalWeight) * 100);
    const cefrLevel = scoreToCefr(score);

    try {
      await onComplete({ score, cefrLevel });
    } catch {
      toast.error(t('saveFailed'));
      setSubmitting(false);
    }
  }

  if (!question) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm text-(--ssz-text-muted)">
          <span>{t('question', { current: current + 1, total: questions.length })}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-(--ssz-primary)"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-base font-medium text-(--ssz-text-primary)">{question.text}</p>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label={question.text}>
        {question.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected === opt.id}
            onClick={() => handleAnswer(opt.id)}
            className={[
              'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
              selected === opt.id
                ? 'border-(--ssz-primary) bg-(--ssz-primary)/10 text-(--ssz-text-primary)'
                : 'border-border bg-surface text-(--ssz-text-secondary) hover:border-(--ssz-border-strong)',
            ].join(' ')}
          >
            {opt.text}
          </button>
        ))}
      </div>

      <Button onClick={handleNext} disabled={!selected || submitting} className="self-end">
        {submitting ? t('saving') : isLast ? t('finish') : t('next')}
      </Button>
    </div>
  );
}
