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

import { useAuthoringLessons } from '../api/use-authoring-lessons';
import { authoringKeys } from '../api/keys';
import { createLessonAction, deleteLessonAction, reorderLessonsAction } from '../actions/lesson';
import { LessonReorder } from './lesson-reorder';
import { LessonEditor } from './lesson-editor';
import { SectionAssignSelect } from './section-assign-select';

interface LessonListProps {
  container: Container;
}

function LessonListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function LessonList({ container }: LessonListProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<ContainerItem[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContainerItem | null>(null);

  const { data: fetchedItems, isLoading, isError } = useAuthoringLessons(container.id);
  const items = localItems ?? fetchedItems ?? [];

  function toggleEditor(lessonId: string) {
    setEditingLessonId((prev) => (prev === lessonId ? null : lessonId));
  }

  function handleAddLesson() {
    startTransition(async () => {
      const result = await createLessonAction(
        container.id,
        container.targetLanguage,
        container.difficultyLevel,
        container.visibility,
        { title: t('lessons.newTitle') },
      );
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.lessons(container.id) });
      setLocalItems(null);
      setEditingLessonId(result.value.lessonId);
    });
  }

  function handleReorder(reordered: ContainerItem[]) {
    setLocalItems(reordered);
    startTransition(async () => {
      const result = await reorderLessonsAction(
        container.id,
        reordered.map((i) => i.id),
      );
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        setLocalItems(null);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.lessons(container.id) });
      setLocalItems(null);
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const result = await deleteLessonAction(target.id, target.itemId, container.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.lessons(container.id) });
      if (editingLessonId === target.itemId) setEditingLessonId(null);
      toast.success(t('lessons.deleteSuccess'));
    });
  }

  if (isLoading) return <LessonListSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">{t('lessons.loadError')}</p>
    );
  }

  const editingItem = items.find((i) => i.itemId === editingLessonId);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t('lessons.empty')}</p>
      ) : (
        <div className="space-y-2">
          <LessonReorder items={items} onReorder={handleReorder}>
            {(item) => (
              <div className="flex flex-1 items-center justify-between rounded-md border border-border bg-[var(--ssz-bg-surface)] px-3 py-2">
                <span className="text-sm font-medium">
                  {item.title ?? t('lessons.untitled')}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <SectionAssignSelect
                    containerId={container.id}
                    containerItemId={item.id}
                    sectionId={item.sectionId}
                    invalidateKeys={[authoringKeys.lessons(container.id)]}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('lessons.editAriaLabel')}
                    onClick={() => toggleEditor(item.itemId)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('lessons.deleteAriaLabel')}
                    onClick={() => setPendingDelete(item)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )}
          </LessonReorder>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={handleAddLesson}
        disabled={isPending}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {t('lessons.add')}
      </Button>

      {editingLessonId && (
        <LessonEditor
          lessonId={editingLessonId}
          lessonTitle={editingItem?.title ?? undefined}
          container={container}
          onClose={() => setEditingLessonId(null)}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lessons.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('lessons.deleteConfirmDescription', {
                title: pendingDelete?.title ?? t('lessons.untitled'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('lessons.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t('lessons.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
