'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Container } from '@/features/content/types';

import { useAuthoringExercises } from '../api/use-authoring-exercises';
import { useLessonVideoQuestion } from '../api/use-authoring-lessons';
import { authoringKeys } from '../api/keys';
import { setVideoQuestionAction, clearVideoQuestionAction } from '../actions/lesson-video-question';
import { EditorCard } from './editor-card';
import { ExerciseEditor } from './exercise-editor';

const NO_QUESTION = '__none__';

interface ComprehensionQuestionRowProps {
  lessonId: string;
  /** Undefined until a video source has been saved at least once (no variant yet). */
  variantId: string | undefined;
  container: Container;
}

export function ComprehensionQuestionRow({
  lessonId,
  variantId,
  container,
}: ComprehensionQuestionRowProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);

  const { data: question, isLoading: isQuestionLoading } = useLessonVideoQuestion(
    lessonId,
    variantId,
  );
  const { data: exercises, isLoading: isExercisesLoading } = useAuthoringExercises(container.id);

  function invalidate() {
    return queryClient.invalidateQueries({
      queryKey: authoringKeys.lessonVideoQuestion(lessonId, variantId ?? ''),
    });
  }

  function handleChange(value: string) {
    if (!variantId) return;
    startTransition(async () => {
      const result =
        value === NO_QUESTION
          ? await clearVideoQuestionAction(lessonId, variantId)
          : await setVideoQuestionAction(lessonId, variantId, value);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await invalidate();
    });
  }

  function handleCreated(exerciseId: string) {
    setIsCreating(false);
    if (!variantId) return;
    startTransition(async () => {
      const result = await setVideoQuestionAction(lessonId, variantId, exerciseId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: authoringKeys.exercises(container.id) }),
      ]);
    });
  }

  if (!variantId) {
    return (
      <EditorCard title={t('editor.comprehensionQuestion')}>
        <p className="text-sm text-muted-foreground">{t('editor.comprehensionQuestionNeedsSource')}</p>
      </EditorCard>
    );
  }

  if (isQuestionLoading || isExercisesLoading) {
    return (
      <EditorCard title={t('editor.comprehensionQuestion')}>
        <Skeleton className="h-9 w-full rounded-md" />
      </EditorCard>
    );
  }

  return (
    <EditorCard title={t('editor.comprehensionQuestion')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={question?.exerciseId ?? NO_QUESTION}
            onValueChange={handleChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-full" aria-label={t('editor.comprehensionQuestionAriaLabel')}>
              <SelectValue placeholder={t('editor.comprehensionQuestionNone')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_QUESTION}>{t('editor.comprehensionQuestionNone')}</SelectItem>
              {(exercises ?? []).map((exercise) => (
                <SelectItem key={exercise.itemId} value={exercise.itemId}>
                  {exercise.title || t('exercises.untitled')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCreating((prev) => !prev)}
            disabled={isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t('editor.comprehensionQuestionAddNew')}
          </Button>
        </div>

        {isCreating && (
          <ExerciseEditor
            exerciseId={null}
            container={container}
            onClose={() => setIsCreating(false)}
            onCreated={handleCreated}
          />
        )}
      </div>
    </EditorCard>
  );
}
