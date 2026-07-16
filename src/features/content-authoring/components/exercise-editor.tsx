'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container } from '@/features/content/types';

import { exerciseFormSchema, type ExerciseFormValues } from '../schemas/exercise';
import { DEFAULT_EXERCISE_VALUES, parseExerciseToForm } from '../lib/exercise-content';
import { createExerciseAction, updateExerciseAction } from '../actions/exercise';
import { useAuthoringExercise } from '../api/use-authoring-exercises';
import { authoringKeys } from '../api/keys';
import { ExerciseFields } from './exercise-fields';

interface ExerciseEditorProps {
  exerciseId: string | null;
  container: Container;
  onClose: () => void;
  onCreated?: (exerciseId: string) => void;
}

export function ExerciseEditor({ exerciseId, container, onClose, onCreated }: ExerciseEditorProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const { data: exercise, isLoading } = useAuthoringExercise(exerciseId);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: DEFAULT_EXERCISE_VALUES,
    values: exercise ? parseExerciseToForm(exercise) : undefined,
  });

  function onSubmit(data: ExerciseFormValues) {
    startTransition(async () => {
      if (exerciseId) {
        const result = await updateExerciseAction(exerciseId, container.id, data);
        if (!result.ok) {
          toast.error(tErrors(result.error.code));
          return;
        }
        await queryClient.invalidateQueries({ queryKey: authoringKeys.exercise(exerciseId) });
        await queryClient.invalidateQueries({ queryKey: authoringKeys.exercises(container.id) });
        toast.success(t('exercises.saveSuccess'));
      } else {
        const result = await createExerciseAction(
          container.id,
          container.targetLanguage,
          container.difficultyLevel,
          container.visibility,
          data,
        );
        if (!result.ok) {
          toast.error(tErrors(result.error.code));
          return;
        }
        await queryClient.invalidateQueries({ queryKey: authoringKeys.exercises(container.id) });
        toast.success(t('exercises.saveSuccess'));
        onCreated?.(result.value.exerciseId);
      }
    });
  }

  if (isLoading && exerciseId) {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('exercises.editingLabel')}</h3>
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>
          {t('lessons.closeEditor')}
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ExerciseFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
          // Type is immutable once the exercise exists (backend binds it to the template).
          typeDisabled={!!exerciseId}
        />

        <Button type="submit" loading={isPending}>
          {t('form.save')}
        </Button>
      </form>
    </div>
  );
}
