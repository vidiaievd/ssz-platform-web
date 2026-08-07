'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  toStudentProjection,
  type GapKey,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';
import { WordBankGapFillBody } from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface GapFillPreviewProps {
  exercise: WordBankGapFill;
  instructions: string;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. A second rendering of the same document would be a second thing to keep in
 * step, and the first time it drifted the preview would be lying about the product.
 *
 * Two deliberate differences from a real attempt. The bank is not shuffled, because a
 * preview that reorders itself on every keystroke is unreadable. And there is no check:
 * grading happens on the server against an attempt, which a preview does not have — so
 * placement is live, and the verdict is the one thing this cannot show.
 */
export function GapFillPreview({ exercise, instructions }: GapFillPreviewProps) {
  const t = useTranslations('Authoring');
  const [placements, setPlacements] = useState<Record<GapKey, string>>({});

  const projection = useMemo(
    () =>
      toStudentProjection({
        sentences: exercise.sentences,
        distractors: exercise.distractors,
        settings: { ...exercise.settings, shuffle: false },
      }),
    [exercise.sentences, exercise.distractors, exercise.settings],
  );

  if (projection.sentences.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">{t('gapFill.preview.empty')}</p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <WordBankGapFillBody
        projection={projection}
        instruction={instructions}
        value={placements}
        onValueChange={setPlacements}
        onAnswerChange={() => {}}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
      />
      <p className="text-center text-[11px] text-muted-foreground">
        {t('gapFill.preview.noCheck')}
      </p>
    </div>
  );
}
