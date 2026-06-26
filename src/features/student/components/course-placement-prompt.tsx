'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useContainerItems } from '@/features/content/api/use-container-items';
import { CEFR_LEVELS } from '@/features/content/lib/cefr-staircase';
import type { DifficultyLevel } from '@/features/content/types';
import { PlacementStaircase } from './placement-staircase';

interface CoursePlacementPromptProps {
  containerId: string;
  versionId?: string;
  targetLanguage: string;
  courseDifficultyLevel: DifficultyLevel;
}

function dismissedKey(containerId: string) {
  return `placement-prompt-dismissed:${containerId}`;
}

/**
 * One-time, skippable prompt shown the first time a learner opens a course —
 * offers the CEFR placement staircase (plan 21 §4.1) and, if the learner tests
 * above the course's level, seeds its vocabulary as DIAGNOSTIC_KNOWN so they
 * aren't asked to tap through material they already know.
 */
export function CoursePlacementPrompt({
  containerId,
  versionId,
  targetLanguage,
  courseDifficultyLevel,
}: CoursePlacementPromptProps) {
  const t = useTranslations('Content.PlacementStaircase');
  const [stage, setStage] = useState<'hidden' | 'prompt' | 'staircase'>('hidden');
  const { data: items } = useContainerItems(containerId, versionId ?? '', stage === 'staircase');

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined') return;
      if (!window.localStorage.getItem(dismissedKey(containerId))) {
        setStage('prompt');
      }
    })();
  }, [containerId]);

  function dismiss() {
    window.localStorage.setItem(dismissedKey(containerId), '1');
    setStage('hidden');
  }

  async function handleComplete(determinedLevel: DifficultyLevel) {
    const determinedIndex = CEFR_LEVELS.indexOf(determinedLevel);
    const courseIndex = CEFR_LEVELS.indexOf(courseDifficultyLevel);

    if (determinedIndex > courseIndex) {
      const vocabularyListIds =
        items?.filter((i) => i.itemType === 'vocabulary_list').map((i) => i.itemId) ?? [];

      await Promise.all(
        vocabularyListIds.map((vocabularyListId) =>
          fetch('/api/srs/cards/bulk-introduce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocabularyListId, seedKind: 'DIAGNOSTIC_KNOWN' }),
          }),
        ),
      );

      toast.success(t('aboveLevel', { level: determinedLevel }));
    } else {
      toast.success(t('matchesLevel', { level: determinedLevel }));
    }

    dismiss();
  }

  if (stage === 'hidden') return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-4">
      {stage === 'prompt' && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="text-(--ssz-primary) h-4 w-4" />
            <span>{t('prompt')}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t('skip')}
            </Button>
            <Button size="sm" onClick={() => setStage('staircase')}>
              {t('start')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'staircase' && (
        <PlacementStaircase targetLanguage={targetLanguage} onComplete={handleComplete} onSkip={dismiss} />
      )}
    </div>
  );
}
