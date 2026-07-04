'use client';

import { useEffect } from 'react';

import type { ExerciseDisplay } from '@/features/content/types';
import { levelIdAt } from './adaptive';
import { usePlacementStore } from './stores/placement-store';

/**
 * Watches the placement store for `flowState === 'loading'` and fetches the
 * next question from the sample BFF route.
 *
 * Mount this hook once inside the component tree that owns the placement flow.
 * It calls `setQuestion` or `setError` on the store automatically.
 */
export function usePlacementQuestion(targetLanguage: string) {
  const flowState = usePlacementStore((s) => s.flowState);
  const levelIndex = usePlacementStore((s) => s.levelIndex);
  const askedQuestionIds = usePlacementStore((s) => s.askedQuestionIds);
  const setQuestion = usePlacementStore((s) => s.setQuestion);
  const setError = usePlacementStore((s) => s.setError);

  // Stable primitive from the id list so the effect dep doesn't change on every render
  const excludeKey = askedQuestionIds.join(',');

  useEffect(() => {
    if (flowState !== 'loading') return;

    let cancelled = false;

    const params = new URLSearchParams({
      targetLanguage,
      difficultyLevel: levelIdAt(levelIndex),
      templateCodes: 'multiple_choice,free_text',
    });
    if (excludeKey) params.set('excludeIds', excludeKey);

    fetch(`/api/content/exercises/sample?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch-failed');
        return res.json() as Promise<ExerciseDisplay>;
      })
      .then((question) => {
        if (!cancelled) setQuestion(question);
      })
      .catch(() => {
        if (!cancelled) setError();
      });

    return () => {
      cancelled = true;
    };
  }, [flowState, levelIndex, excludeKey, targetLanguage, setQuestion, setError]);
}
