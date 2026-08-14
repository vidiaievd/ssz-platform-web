'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  toStudentProjection,
  type StudentProjection,
  type Translate,
} from '@/lib/shared-kernel/translate';
import { TranslateRunnerBody, type TranslateValue } from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface TranslatePreviewProps {
  exercise: Translate;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. A second rendering of the same document would be a second thing to keep in
 * step, and the first time it drifted the preview would be lying about the product.
 *
 * It goes through `toStudentProjection` for the reason that matters most in this template:
 * the answer key *is* the answer here, so the projection is what keeps it out of the
 * browser. An author looking at this column sees exactly as much as the server sends —
 * the sentences, the glosses, the hints — and no accepted translation, which is also the
 * quickest way to notice that a sentence gives its own answer away.
 *
 * A verdict is the one thing it cannot show: grading happens on the server against an
 * attempt, which a preview does not have. That is what the tester on steps 2 and 3 is for.
 */
export function TranslatePreview({ exercise }: TranslatePreviewProps) {
  const t = useTranslations('Authoring');
  const projection = toStudentProjection(exercise);

  if (projection.items.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('translate.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {/*
        Above the exercise, not under it. The fields here are typeable — the runner is the
        real one — so an author will answer a sentence in the preview and wait for a
        verdict that is never coming.
      */}
      <p className="rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-3 py-2 text-[11px] text-muted-foreground">
        {t('translate.preview.noCheck')}
      </p>

      {/*
        Anything typed here belongs to the sentences it was typed against. Rewriting a
        sentence in step 2 leaves an answer standing under a different task, so the
        sentences are the key and editing them clears the drafts.
      */}
      <Attempt
        key={projection.items.map((item) => `${item.id}|${item.source}`).join(' ')}
        projection={projection}
        instruction={exercise.instructions}
      />
    </div>
  );
}

interface AttemptProps {
  projection: StudentProjection;
  instruction: string;
}

/** The runner over one version of the sentences, holding what was tried on them. */
function Attempt({ projection, instruction }: AttemptProps) {
  const [value, setValue] = useState<TranslateValue>({});

  return (
    <TranslateRunnerBody
      projection={projection}
      instruction={instruction}
      value={value}
      onValueChange={setValue}
      onAnswerChange={() => {}}
      phase="answering"
      mode="practice"
      accent={PRACTICE_ACCENT}
    />
  );
}
