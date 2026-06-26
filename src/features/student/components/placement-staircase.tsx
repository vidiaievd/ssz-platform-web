'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DifficultyLevel, ExerciseDisplay } from '@/features/content/types';
import { nextLevel, shouldStop, STAIRCASE_START_LEVEL } from '@/features/content/lib/cefr-staircase';
import { ExerciseInteraction } from '../exercises';
import type { AttemptResult } from '../types/exercise';

interface PlacementStaircaseProps {
  targetLanguage: string;
  onComplete: (level: DifficultyLevel) => void;
  onSkip: () => void;
}

export function PlacementStaircase({ targetLanguage, onComplete, onSkip }: PlacementStaircaseProps) {
  const t = useTranslations('Content.PlacementStaircase');
  const [levels, setLevels] = useState<DifficultyLevel[]>([STAIRCASE_START_LEVEL]);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [pendingResult, setPendingResult] = useState<AttemptResult | null>(null);

  const currentLevel = levels[levels.length - 1]!;
  const round = levels.length;

  const {
    data: exercise,
    isLoading,
    error,
  } = useQuery<ExerciseDisplay>({
    queryKey: ['placement-staircase', targetLanguage, currentLevel, askedIds.join(',')],
    queryFn: async () => {
      const params = new URLSearchParams({ targetLanguage, difficultyLevel: currentLevel });
      if (askedIds.length > 0) params.set('excludeIds', askedIds.join(','));
      const res = await fetch(`/api/content/exercises/sample?${params.toString()}`);
      if (!res.ok) throw new Error('no-exercise');
      return res.json() as Promise<ExerciseDisplay>;
    },
    retry: false,
    staleTime: Infinity,
  });

  function handleNext() {
    if (!pendingResult || !exercise) return;
    const wasCorrect = pendingResult.verdict === 'correct';
    const newLevel = nextLevel(currentLevel, wasCorrect);
    const newLevels = [...levels, newLevel];
    setAskedIds((ids) => [...ids, exercise.id]);
    setPendingResult(null);

    if (shouldStop(newLevels)) {
      onComplete(newLevel);
    } else {
      setLevels(newLevels);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-muted-foreground text-sm">{t('noMoreQuestions')}</p>
        <Button onClick={() => onComplete(currentLevel)}>{t('useLevel', { level: currentLevel })}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="text-(--ssz-primary) h-4 w-4" />
          <span>{t('round', { round })}</span>
        </div>
        <button type="button" onClick={onSkip} className="text-muted-foreground text-xs hover:underline">
          {t('skip')}
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}

      {exercise && (
        <div className="flex flex-col gap-3">
          <ExerciseInteraction key={exercise.id} exercise={exercise} onAnswered={setPendingResult} />
          {pendingResult && (
            <Button onClick={handleNext} className="self-end">
              {t('next')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
