'use client';

import { useState, useTransition } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Container, VocabularyItem, VocabularyList } from '@/features/content/types';

import { vocabularyListFormSchema, type VocabularyListFormValues } from '../schemas/vocabulary';
import { createVocabularyListAction, deleteVocabularyItemAction } from '../actions/vocabulary';
import {
  useAuthoringVocabularyLists,
  useAuthoringVocabularyItems,
} from '../api/use-authoring-vocabulary';
import { authoringKeys } from '../api/keys';
import { VocabularyForm } from './vocabulary-form';

interface VocabularyTableProps {
  container: Container;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

function CreateListSection({ container }: { container: Container }) {
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
    <div className="py-10 text-center">
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
  );
}

function ItemsSection({
  container,
  list,
}: {
  container: Container;
  list: VocabularyList;
}) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VocabularyItem | null>(null);

  const { data, isLoading, isError } = useAuthoringVocabularyItems(list.id, page);
  const items = data?.items;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const result = await deleteVocabularyItemAction(list.id, target.id, container.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.vocabularyItemsAll(list.id),
      });
      if (editingItemId === target.id) setEditingItemId(null);
      toast.success(t('vocabulary.deleteSuccess'));
    });
  }

  if (isLoading) return <TableSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {t('vocabulary.loadError')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {t('vocabulary.wordCount', { count: total })}
        </p>
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

      {!items || items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t('vocabulary.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="text-muted-foreground pb-2 pr-4 text-xs font-medium uppercase tracking-wide">
                  {t('vocabulary.lemma')}
                </th>
                <th className="text-muted-foreground pb-2 pr-4 text-xs font-medium uppercase tracking-wide">
                  {t('vocabulary.translations')}
                </th>
                <th className="text-muted-foreground pb-2 pr-4 text-xs font-medium uppercase tracking-wide">
                  {t('vocabulary.examplesCount')}
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="group">
                  <td className="py-2 pr-4">
                    <span className="font-medium">{item.lemma}</span>
                    {item.ipa && (
                      <span className="text-muted-foreground ml-1.5 text-xs">/{item.ipa}/</span>
                    )}
                    {item.partOfSpeech && (
                      <span className="text-muted-foreground ml-1.5 text-xs italic">
                        {item.partOfSpeech}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="text-muted-foreground">
                      {item.translations
                        .slice(0, 3)
                        .map((tr) => `${tr.languageCode}: ${tr.translation}`)
                        .join(' · ')}
                      {item.translations.length > 3 && (
                        <span> +{item.translations.length - 3}</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-center">
                    <span className="text-muted-foreground">{item.examples.length}</span>
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
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

      <Dialog open={editingItemId !== null} onOpenChange={(open) => !open && setEditingItemId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItemId === 'new' ? t('vocabulary.addWord') : t('vocabulary.editWord')}
            </DialogTitle>
          </DialogHeader>
          {editingItemId !== null && (
            <VocabularyForm
              listId={list.id}
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
              {t('vocabulary.deleteConfirmDescription', {
                lemma: pendingDelete?.lemma ?? '',
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

export function VocabularyTable({ container }: VocabularyTableProps) {
  const t = useTranslations('Authoring');
  const { data: lists, isLoading, isError } = useAuthoringVocabularyLists(container.id);

  if (isLoading) return <TableSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {t('vocabulary.loadError')}
      </p>
    );
  }

  const list = lists?.[0];
  if (!list) return <CreateListSection container={container} />;

  return <ItemsSection container={container} list={list} />;
}
