'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { authoringKeys } from '../api/keys';
import { EditorCard } from './editor-card';

interface GlossaryMarkPanelProps {
  lessonId: string;
  /** Undefined until the anchor text has been saved at least once (no variant yet). */
  variantId: string | undefined;
  /** The item's own module Container — the vocab list to pick words from lives here. */
  container: Container;
}

/**
 * Associates existing vocabulary items with this lesson variant's glossary
 * (BE1.5). Not text-selection driven — the backend stores no span/position,
 * only `vocabularyItemId` + an auto-incrementing `occurrenceCount`, so
 * marking is "pick a word from the module's vocab list", not "select text".
 * There is no unmark endpoint.
 */
export function GlossaryMarkPanel({ lessonId, variantId, container }: GlossaryMarkPanelProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [selectedItemId, setSelectedItemId] = useState('');

  const { data: lists } = useAuthoringVocabularyLists(container.id);
  const list = lists?.[0];
  const { data: itemsPage } = useAuthoringVocabularyItems(list?.id ?? '', 1, !!list);
  const { data: marks } = useLessonGlossaryMarks(lessonId, variantId);

  const items = itemsPage?.items ?? [];
  const markedIds = new Set((marks ?? []).map((m) => m.vocabularyItemId));
  const unmarkedItems = items.filter((item) => !markedIds.has(item.id));

  function lemmaFor(vocabularyItemId: string) {
    return items.find((item) => item.id === vocabularyItemId)?.lemma ?? vocabularyItemId;
  }

  function handleMark() {
    if (!variantId || !selectedItemId) return;
    startTransition(async () => {
      const result = await markGlossaryWordAction(lessonId, variantId, selectedItemId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      setSelectedItemId('');
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.lessonGlossaryMarks(lessonId, variantId),
      });
    });
  }

  if (!variantId) {
    return (
      <EditorCard title={t('editor.glossaryMarks')}>
        <p className="text-sm text-muted-foreground">{t('editor.glossaryMarksNeedsBody')}</p>
      </EditorCard>
    );
  }

  if (!list) {
    return (
      <EditorCard title={t('editor.glossaryMarks')}>
        <p className="text-sm text-muted-foreground">{t('editor.glossaryMarksNoList')}</p>
      </EditorCard>
    );
  }

  return (
    <EditorCard title={t('editor.glossaryMarks')}>
      <div className="flex flex-col gap-3">
        {marks && marks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {marks.map((mark) => (
              <Badge key={mark.id} variant="muted">
                {lemmaFor(mark.vocabularyItemId)}
                {mark.occurrenceCount > 1 ? ` ×${mark.occurrenceCount}` : ''}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select
            value={selectedItemId}
            onValueChange={setSelectedItemId}
            disabled={unmarkedItems.length === 0}
          >
            <SelectTrigger className="flex-1">
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

        <p className="text-xs text-muted-foreground">
          {t('editor.glossaryMarksCaption', { count: marks?.length ?? 0 })}
        </p>
      </div>
    </EditorCard>
  );
}
