'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';
import { WritingTaskBody, type WritingTaskValue } from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface WritingTaskPreviewProps {
  exercise: WritingTask;
  /** The picture for `mode: 'picture'`, already resolved to a URL by the caller. */
  imageUrl?: string | null;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. A second rendering of the same document would be a second thing to keep in
 * step, and the first time it drifted the preview would be lying about the product.
 *
 * It goes through `toStudentProjection` rather than handing the document straight over,
 * and that is the point of the panel rather than a detail of it. The projection is what
 * takes the answer key away — the point keywords, the model answer, and the level
 * descriptors unless `showRubric: 'always'` (plan 50 §5). An author who wonders whether
 * their students will see the rubric while they write is asking a question only this
 * panel can answer, because the answer is a setting three steps away from where the
 * rubric is written.
 *
 * Nothing here submits. Grading happens on the server against an attempt, and a writing
 * task's grade is a person reading it — so the surface is live, and the verdict is the
 * one thing a preview cannot show.
 */
export function WritingTaskPreview({ exercise, imageUrl }: WritingTaskPreviewProps) {
  const t = useTranslations('Authoring');
  const [value, setValue] = useState<WritingTaskValue>({ text: '', ticked: [] });

  const projection = useMemo(
    () => toStudentProjection(toContent(exercise), toExpectedAnswers(exercise)),
    [exercise],
  );

  if (projection.prompt.trim() === '') {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('writingTask.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <WritingTaskBody
        task={projection}
        value={value}
        onValueChange={setValue}
        phase="draft"
        interactive
        imageUrl={imageUrl ?? null}
        mode="practice"
        accent={PRACTICE_ACCENT}
      />
      <p className="text-center text-[11px] text-muted-foreground">
        {t('writingTask.preview.noCheck')}
      </p>
    </div>
  );
}
