'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Container, VocabularyItem } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { vocabularyListFormSchema, type VocabularyListFormValues } from '../schemas/vocabulary';
import { createVocabularyListAction, deleteVocabularyItemAction } from '../actions/vocabulary';
import {
  useAuthoringVocabularyLists,
  useAuthoringVocabularyItems,
} from '../api/use-authoring-vocabulary';
import { authoringKeys } from '../api/keys';
import { LessonEditorShell } from './lesson-editor-shell';
import { EditorCard } from './editor-card';
import { VocabularyForm } from './vocabulary-form';
import { VocabularyLessonPreview } from './vocabulary-lesson-preview';
import { VocabularyBulkPasteDialog } from './vocabulary-bulk-paste-dialog';

interface VocabularyEditorPaneProps {
  kind: MaterialKind;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function VocabularyEditorPane({
  kind,
  lessonTitle,
  state,
  container,
  backHref,
  publishSlot,
}: VocabularyEditorPaneProps) {
  const t = useTranslations('Authoring');
  const { data: lists, isLoading, isError } = useAuthoringVocabularyLists(container.id);
  const list = lists?.[0];

  return (
    <LessonEditorShell
      kind={kind}
      title={lessonTitle || t('lessons.untitled')}
      state={state}
      backHref={backHref}
      saveStatus="idle"
      savedAt={null}
      publishSlot={publishSlot}
      preview={<VocabularyLessonPreview title={lessonTitle ?? ''} listId={list?.id} />}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t('vocabulary.loadError')}
        </p>
      ) : !list ? (
        <CreateListCard container={container} />
      ) : (
        <WordListCard container={container} listId={list.id} />
      )}
    </LessonEditorShell>
  );
}

function CreateListCard({ container }: { container: Container }) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VocabularyListFormValues>({
    resolver: zodResolver(vocabularyListFormSchema),
    defaultValues: { title: '' },
  });

  function onSubmit(data: VocabularyListFormValues) {
    startTransition(async () => {
      const result = await createVocabularyListAction(
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
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.vocabularyLists(container.id),
      });
    });
  }

  return (
    <EditorCard>
      <div className="py-6 text-center">
        <p className="text-muted-foreground mb-4 text-sm">{t('vocabulary.noList')}</p>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mx-auto flex max-w-sm items-start gap-2"
        >
          <Field htmlFor="vl-title" error={errors.title?.message} className="flex-1">
            <Input
              id="vl-title"
              placeholder={t('vocabulary.listTitlePlaceholder')}
              hasError={!!errors.title}
              disabled={isPending}
              {...register('title')}
            />
          </Field>
          <Button type="submit" loading={isPending}>
            {t('vocabulary.createList')}
          </Button>
        </form>
      </div>
    </EditorCard>
  );
}

function WordListCard({ container, listId }: { container: Container; listId: string }) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VocabularyItem | null>(null);

  const { data, isLoading, isError } = useAuthoringVocabularyItems(listId, page);
  const items = data?.items;
  const totalPages = data?.totalPages ?? 1;

  function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const result = await deleteVocabularyItemAction(listId, target.id, container.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.vocabularyItemsAll(listId) });
      if (editingItemId === target.id) setEditingItemId(null);
      toast.success(t('vocabulary.deleteSuccess'));
    });
  }

  return (
    <EditorCard
      title={t('vocabulary.words')}
      right={
        <div className="flex items-center gap-1.5">
          <VocabularyBulkPasteDialog listId={listId} containerId={container.id} />
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setEditingItemId('new')}
            disabled={isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('vocabulary.addWord')}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[11px]" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {t('vocabulary.loadError')}
        </p>
      ) : !items || items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t('vocabulary.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2.5 rounded-[11px] border border-border bg-(--ssz-bg-base) p-3"
            >
              <div className="grid min-w-0 flex-1 grid-cols-[1.1fr_1.1fr_0.7fr] items-center gap-2.5">
                <div className="min-w-0 truncate">
                  <span className="font-reading font-medium text-foreground">{item.lemma}</span>
                  {item.ipa && (
                    <span className="ml-1.5 text-xs text-muted-foreground">/{item.ipa}/</span>
                  )}
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {item.translations[0]?.translation ?? '—'}
                  {item.translations.length > 1 && ` +${item.translations.length - 1}`}
                </span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {item.partOfSpeech ?? ''}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={t('vocabulary.editWord')}
                  onClick={() => setEditingItemId(item.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={t('vocabulary.deleteWord')}
                  onClick={() => setPendingDelete(item)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('vocabulary.pageOf', { page, totalPages })}</span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={editingItemId !== null}
        onOpenChange={(open) => !open && setEditingItemId(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItemId === 'new' ? t('vocabulary.addWord') : t('vocabulary.editWord')}
            </DialogTitle>
          </DialogHeader>
          {editingItemId !== null && (
            <VocabularyForm
              listId={listId}
              containerId={container.id}
              itemId={editingItemId === 'new' ? undefined : editingItemId}
              onDone={() => setEditingItemId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('vocabulary.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('vocabulary.deleteConfirmDescription', { lemma: pendingDelete?.lemma ?? '' })}
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
    </EditorCard>
  );
}
