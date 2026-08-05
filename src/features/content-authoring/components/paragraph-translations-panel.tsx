'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { useLessonParagraphs } from '../api/use-authoring-lessons';
import { saveParagraphTranslationsAction } from '../actions/lesson-paragraphs';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { SaveStatusIndicator } from './save-status-indicator';
import { PanelSaveButton } from './panel-save-button';
import { EditorCard } from './editor-card';

interface ParagraphTranslationsPanelProps {
  lessonId: string;
  /** Undefined until the anchor text has been saved at least once (no variant yet). */
  variantId: string | undefined;
}

/**
 * Per-paragraph bilingual translation entry (BE1.4). Full-replace on save, so
 * all rows share one autosave debounce rather than one per row.
 */
export function ParagraphTranslationsPanel({
  lessonId,
  variantId,
}: ParagraphTranslationsPanelProps) {
  const t = useTranslations('Authoring');
  const { data: paragraphs, isLoading } = useLessonParagraphs(lessonId, variantId);
  const [translations, setTranslations] = useState<string[]>([]);
  // Reseed from the server only when the paragraph count changes (e.g. the
  // anchor text was re-split after an edit) — not on every refetch, so
  // in-flight translation edits survive query invalidation. Adjusting state
  // during render (not an effect) avoids the extra commit + cascading render.
  const [seededCount, setSeededCount] = useState<number | null>(null);
  if (paragraphs && paragraphs.length !== seededCount) {
    setSeededCount(paragraphs.length);
    setTranslations(paragraphs.map((p) => p.translation ?? ''));
  }

  const unsaved = useUnsavedChanges({
    onSave: async () => {
      if (!variantId) return;
      const entries = translations
        .map((translation, paragraphIndex) => ({ paragraphIndex, translation: translation.trim() }))
        .filter((entry) => entry.translation.length > 0);
      const result = await saveParagraphTranslationsAction(lessonId, variantId, entries);
      if (!result.ok) throw new Error(result.error.code);
    },
  });

  function handleChange(index: number, value: string) {
    setTranslations((prev) => prev.map((v, i) => (i === index ? value : v)));
    unsaved.markDirty();
  }

  if (!variantId) {
    return (
      <EditorCard title={t('editor.paragraphTranslations')}>
        <p className="text-sm text-muted-foreground">
          {t('editor.paragraphTranslationsNeedsBody')}
        </p>
      </EditorCard>
    );
  }

  if (isLoading) {
    return (
      <EditorCard title={t('editor.paragraphTranslations')}>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </EditorCard>
    );
  }

  return (
    <EditorCard
      title={t('editor.paragraphTranslations')}
      right={<SaveStatusIndicator status={unsaved.status} savedAt={unsaved.savedAt} />}
    >
      {!paragraphs || paragraphs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('editor.paragraphTranslationsEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {paragraphs.map((p, i) => (
            <div key={i} className="rounded-lg border border-border bg-(--ssz-bg-base) p-3">
              <p className="mb-2 font-reading text-sm text-foreground">{p.target}</p>
              <Textarea
                rows={2}
                placeholder={t('editor.paragraphTranslationPlaceholder')}
                aria-label={t('editor.paragraphTranslationPlaceholder')}
                value={translations[i] ?? ''}
                onChange={(e) => handleChange(i, e.target.value)}
              />
            </div>
          ))}
          <PanelSaveButton
            unsaved={unsaved}
            label={t('editor.saveTranslations')}
            className="self-end"
          />
        </div>
      )}
    </EditorCard>
  );
}
