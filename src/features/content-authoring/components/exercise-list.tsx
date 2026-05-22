'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Container, ContainerItem } from '@/features/content/types';

import { useAuthoringExercises } from '../api/use-authoring-exercises';
import { authoringKeys } from '../api/keys';
import { deleteExerciseAction } from '../actions/exercise';
import { ExerciseEditor } from './exercise-editor';

interface ExerciseListProps {
  container: Container;
}

type EditingState = string | 'new' | null;

function ExerciseListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function ExerciseList({ container }: ExerciseListProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editingState, setEditingState] = useState<EditingState>(null);
  const [pendingDelete, setPendingDelete] = useState<ContainerItem | null>(null);

  const { data: exercises, isLoading, isError } = useAuthoringExercises(container.id);

  function toggleEditor(exerciseId: string) {
    setEditingState((prev) => (prev === exerciseId ? null : exerciseId));
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const result = await deleteExerciseAction(target.contentId, container.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.exercises(container.id) });
      if (editingState === target.contentId) setEditingState(null);
      toast.success(t('exercises.deleteSuccess'));
    });
  }

  if (isLoading) return <ExerciseListSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {t('exercises.loadError')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!exercises || exercises.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t('exercises.empty')}</p>
      ) : (
        <div className="space-y-2">
          {exercises.map((exercise) => (
            <div key={exercise.id}>
              <div className="flex items-center justify-between rounded-md border border-border bg-[var(--ssz-bg-surface)] px-3 py-2">
                <span className="text-sm font-medium">
                  {exercise.title || t('exercises.untitled')}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('exercises.editAriaLabel')}
                    onClick={() => toggleEditor(exercise.contentId)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('exercises.deleteAriaLabel')}
                    onClick={() => setPendingDelete(exercise)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {editingState === exercise.contentId && (
                <ExerciseEditor
                  exerciseId={exercise.contentId}
                  container={container}
                  onClose={() => setEditingState(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setEditingState('new')}
        disabled={isPending || editingState === 'new'}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {t('exercises.add')}
      </Button>

      {editingState === 'new' && (
        <ExerciseEditor
          exerciseId={null}
          container={container}
          onClose={() => setEditingState(null)}
          onCreated={(id) => setEditingState(id)}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('exercises.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('exercises.deleteConfirmDescription', {
                title: pendingDelete?.title || t('exercises.untitled'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('exercises.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t('exercises.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
