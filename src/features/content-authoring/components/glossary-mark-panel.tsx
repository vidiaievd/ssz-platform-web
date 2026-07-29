'use client';

import { useState, useTransition } from 'react';
import { Highlighter, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Container } from '@/features/content/types';

import { useAuthoringVocabularyLists, useAuthoringVocabularyItems } from '../api/use-authoring-vocabulary';
import { useLessonGlossaryMarks } from '../api/use-authoring-lessons';
import { markGlossaryWordAction } from '../actions/lesson-glossary';
import { unmarkGlossaryWordAction } from '../actions/lesson-spans';
import { authoringKeys } from '../api/keys';

interface GlossaryMarkProps {
  lessonId: string;
  /** Undefined until the anchor text has been saved at least once (no variant yet). */
  variantId: string | undefined;
  /** The item's own module Container — the vocab list to pick words from lives here. */
  container: Container;
}

/**
 * Shared read model for both the header "Mark word" popover and the inline
 * marked-words display. Marking is vocab-item-based (BE1.5): the backend stores
 * no span/position, only `vocabularyItemId` + an auto-incrementing
 * `occurrenceCount`, so marking is "pick a word from the module's vocab list",
 * not "select text". There is no unmark endpoint.
 */
function useGlossaryMarkData({ lessonId, variantId, container }: GlossaryMarkProps) {
  const { data: lists } = useAuthoringVocabularyLists(container.id);
  const list = lists?.[0];
  const { data: itemsPage } = useAuthoringVocabularyItems(list?.id ?? '', 1, !!list);
  const { data: marks } = useLessonGlossaryMarks(lessonId, variantId);

  const items = itemsPage?.items ?? [];
  const markedIds = new Set((marks ?? []).map((m) => m.vocabularyItemId));

  return {
    list,
    items,
    marks: marks ?? [],
    unmarkedItems: items.filter((item) => !markedIds.has(item.id)),
    lemmaFor: (vocabularyItemId: string) =>
      items.find((item) => item.id === vocabularyItemId)?.lemma ?? vocabularyItemId,
  };
}

/**
 * Header action for the anchor-text card: opens a popover to pick an existing
 * vocabulary word and add it to this lesson variant's glossary.
 */
export function GlossaryMarkButton({ lessonId, variantId, container }: GlossaryMarkProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');

  const { list, unmarkedItems } = useGlossaryMarkData({ lessonId, variantId, container });

  function handleMark() {
    if (!variantId || !selectedItemId) return;
    startTransition(async () => {
      const result = await markGlossaryWordAction(lessonId, variantId, selectedItemId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      setSelectedItemId('');
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.lessonGlossaryMarks(lessonId, variantId),
      });
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <Highlighter aria-hidden /> {t('editor.glossaryMarksMarkWord')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        {!variantId ? (
          <p className="text-sm text-muted-foreground">{t('editor.glossaryMarksNeedsBody')}</p>
        ) : !list ? (
          <p className="text-sm text-muted-foreground">{t('editor.glossaryMarksNoList')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Select
              value={selectedItemId}
              onValueChange={setSelectedItemId}
              disabled={unmarkedItems.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('editor.glossaryMarksPickWord')} />
              </SelectTrigger>
              <SelectContent>
                {unmarkedItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.lemma}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={handleMark}
              disabled={!selectedItemId || isPending}
              loading={isPending}
            >
              {t('editor.glossaryMarksMark')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline display under the anchor-text render: the marked-word chips and the
 * "N words marked" glossary caption (design_handoff_course_management).
 */
export function GlossaryMarkedWords({ lessonId, variantId, container }: GlossaryMarkProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [pendingUnmark, setPendingUnmark] = useState<{ id: string; lemma: string } | null>(null);
  const { marks, lemmaFor } = useGlossaryMarkData({ lessonId, variantId, container });

  function confirmUnmark() {
    const target = pendingUnmark;
    setPendingUnmark(null);
    if (!variantId || !target) return;

    startTransition(async () => {
      const result = await unmarkGlossaryWordAction(lessonId, variantId, target.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      toast.success(t('spans.unmarked'));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: authoringKeys.lessonGlossaryMarks(lessonId, variantId),
        }),
        // Unmarking cascades to this variant's vocab spans for the word.
        queryClient.invalidateQueries({
          queryKey: authoringKeys.lessonTextSpans(lessonId, variantId),
        }),
      ]);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {marks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {marks.map((mark) => {
            const lemma = lemmaFor(mark.vocabularyItemId);
            return (
              <Badge key={mark.id} variant="muted" className="gap-1 pr-1">
                {lemma}
                {mark.occurrenceCount > 1 ? ` ×${mark.occurrenceCount}` : ''}
                <button
                  type="button"
                  aria-label={t('spans.unmark', { lemma })}
                  disabled={isPending}
                  onClick={() => setPendingUnmark({ id: mark.vocabularyItemId, lemma })}
                  className="rounded-sm p-0.5 hover:text-(--ssz-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/*
        Confirmed, unlike deleting a single span: this drops the word from the
        lesson glossary and takes its annotations in this text with it, and the
        cascade is not visible from the chip being clicked.
      */}
      <AlertDialog open={!!pendingUnmark} onOpenChange={(open) => !open && setPendingUnmark(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('spans.unmarkConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('spans.unmarkConfirmBody', { lemma: pendingUnmark?.lemma ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('lessons.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnmark}>{t('spans.unmarkConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Highlighter className="size-3.5" aria-hidden />
        {t('editor.glossaryMarksCaption', { count: marks.length })}
      </p>
    </div>
  );
}
