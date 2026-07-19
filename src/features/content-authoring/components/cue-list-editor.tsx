'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { useLessonCues } from '../api/use-authoring-lessons';
import { saveLessonCuesAction } from '../actions/lesson-cues';
import { useAutosave } from '../hooks/use-autosave';
import { AutosaveIndicator } from './autosave-indicator';
import { EditorCard } from './editor-card';
import { ReorderWithAnnouncer } from './lesson-reorder';

interface CueRow {
  /** Client-only stable key for React/dnd-kit — never sent to the backend, which is keyed by array position. */
  key: string;
  startSeconds: number;
  targetLine: string;
  translationLine: string;
}

interface CueListEditorProps {
  lessonId: string;
  /** Undefined until a video source has been saved at least once (no variant yet). */
  variantId: string | undefined;
}

/**
 * Ordered transcript cue list for a VIDEO lesson variant (BE1.2). Full-replace
 * on save, mirroring ParagraphTranslationsPanel, but rows are freely
 * added/removed/reordered rather than derived from a fixed paragraph count.
 */
export function CueListEditor({ lessonId, variantId }: CueListEditorProps) {
  const t = useTranslations('Authoring');
  const { data: cues, isLoading } = useLessonCues(lessonId, variantId);
  const [rows, setRows] = useState<CueRow[]>([]);
  const keyCounter = useRef(0);
  // Only safe to call from event handlers — mutates a ref, so never call
  // this while rendering (see the deterministic seed-batch keys below).
  function nextKey() {
    keyCounter.current += 1;
    return `cue-${keyCounter.current}`;
  }

  // Reseed from the server only when the cue count changes (e.g. on first
  // load) — not on every refetch, so in-flight edits survive query
  // invalidation. Adjusting state during render (not an effect) avoids the
  // extra commit + cascading render. Keys are derived from the seed batch
  // itself (not a mutated ref) since refs may not be touched during render.
  const [seededCount, setSeededCount] = useState<number | null>(null);
  if (cues && cues.length !== seededCount) {
    setSeededCount(cues.length);
    setRows(
      cues.map((c, i) => ({
        key: `cue-seed-${cues.length}-${i}`,
        startSeconds: c.startSeconds,
        targetLine: c.targetLine,
        translationLine: c.translationLine ?? '',
      })),
    );
  }

  const autosave = useAutosave({
    onSave: async () => {
      if (!variantId) return;
      const entries = rows
        .map((row, position) => ({
          position,
          startSeconds: row.startSeconds,
          targetLine: row.targetLine.trim(),
          translationLine: row.translationLine.trim() || undefined,
        }))
        .filter((entry) => entry.targetLine.length > 0);
      const result = await saveLessonCuesAction(lessonId, variantId, entries);
      if (!result.ok) throw new Error(result.error.code);
    },
    debounceMs: 800,
  });

  function updateRow(key: string, patch: Partial<CueRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    autosave.schedule();
  }

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey(), startSeconds: 0, targetLine: '', translationLine: '' }]);
    autosave.schedule();
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
    autosave.schedule();
  }

  function handleReorder(reordered: CueRow[]) {
    setRows(reordered);
    autosave.schedule();
  }

  if (!variantId) {
    return (
      <EditorCard title={t('editor.cueList')}>
        <p className="text-sm text-muted-foreground">{t('editor.cueListNeedsSource')}</p>
      </EditorCard>
    );
  }

  if (isLoading) {
    return (
      <EditorCard title={t('editor.cueList')}>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </EditorCard>
    );
  }

  return (
    <EditorCard
      title={t('editor.cueList')}
      right={<AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />}
    >
      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('editor.cueListEmpty')}</p>
        )}

        <ReorderWithAnnouncer
          items={rows.map((row) => ({ id: row.key, title: row.targetLine }))}
          onReorder={(reorderedRefs) =>
            handleReorder(
              reorderedRefs.map((ref) => rows.find((row) => row.key === ref.id) as CueRow),
            )
          }
        >
          {(ref, position) => {
            const row = rows.find((r) => r.key === ref.id);
            if (!row) return null;
            return (
              <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-(--ssz-bg-base) p-3">
                <div className="flex items-center gap-2">
                  <Field label={t('editor.cueTimecode')} htmlFor={`cue-timecode-${row.key}`} className="w-28">
                    <Input
                      id={`cue-timecode-${row.key}`}
                      type="number"
                      min={0}
                      step={0.1}
                      value={row.startSeconds}
                      onChange={(e) => updateRow(row.key, { startSeconds: Number(e.target.value) })}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(row.key)}
                    aria-label={t('editor.cueRemove', { position })}
                    className="mt-auto mb-0.5 text-destructive hover:text-destructive"
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                <Field label={t('editor.cueTarget')} htmlFor={`cue-target-${row.key}`}>
                  <Textarea
                    id={`cue-target-${row.key}`}
                    rows={2}
                    placeholder={t('editor.cueTargetPlaceholder')}
                    value={row.targetLine}
                    onChange={(e) => updateRow(row.key, { targetLine: e.target.value })}
                  />
                </Field>
                <Field label={t('editor.cueEnglish')} htmlFor={`cue-english-${row.key}`}>
                  <Textarea
                    id={`cue-english-${row.key}`}
                    rows={2}
                    placeholder={t('editor.cueEnglishPlaceholder')}
                    value={row.translationLine}
                    onChange={(e) => updateRow(row.key, { translationLine: e.target.value })}
                  />
                </Field>
              </div>
            );
          }}
        </ReorderWithAnnouncer>

        <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t('editor.cueAdd')}
        </Button>
      </div>
    </EditorCard>
  );
}
