'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { toStudentProjection, type ErrorCorrection } from '@/lib/shared-kernel/error-correction';
import {
  ErrorCorrectionBody,
  type ErrorCorrectionValue,
} from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface ErrorCorrectionPreviewProps {
  exercise: ErrorCorrection;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. A second rendering of the same document would be a second thing to keep in
 * step, and the first time it drifted the preview would be lying about the product.
 *
 * It runs the document through `toStudentProjection` rather than handing the runner the
 * document, which is what keeps this honest: the preview shows exactly as much as the
 * server would send, so an author looking at it cannot mistake what the student is told.
 * Grading is the one thing it cannot show — that happens on the server against an
 * attempt, which a preview does not have. The author's tester (step 2) is where a verdict
 * can be seen.
 */
export function ErrorCorrectionPreview({ exercise }: ErrorCorrectionPreviewProps) {
  const t = useTranslations('Authoring');
  const [value, setValue] = useState<ErrorCorrectionValue>({});

  const projection = useMemo(() => toStudentProjection(exercise), [exercise]);

  if (projection.items.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('errorCorrection.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <ErrorCorrectionBody
        projection={projection}
        instruction={exercise.instructions}
        value={value}
        onValueChange={setValue}
        onAnswerChange={() => {}}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
      />
      <p className="text-center text-[11px] text-muted-foreground">
        {t('errorCorrection.preview.noCheck')}
      </p>
    </div>
  );
}
