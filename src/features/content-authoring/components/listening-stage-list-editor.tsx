'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Container, ListeningStageType } from '@/features/content/types';

import { useAuthoringExercises } from '../api/use-authoring-exercises';
import { useListeningStages } from '../api/use-authoring-lessons';
import { saveListeningStagesAction } from '../actions/listening-stages';
import { useAutosave } from '../hooks/use-autosave';
import { AutosaveIndicator } from './autosave-indicator';
import { EditorCard } from './editor-card';
import { ExerciseEditor } from './exercise-editor';
import { ReorderWithAnnouncer } from './lesson-reorder';

interface StageRow {
  /** Client-only stable key for React/dnd-kit — never sent to the backend, which is keyed by array position. */
  key: string;
  exerciseId: string | null;
  stageType: ListeningStageType;
  creating: boolean;
}

interface ListeningStageListEditorProps {
  lessonId: string;
  /** Undefined until an audio source has been saved at least once (no variant yet). */
  variantId: string | undefined;
  container: Container;
}

const STAGE_TYPES: ListeningStageType[] = ['gap_fill', 'comprehension'];
const NO_EXERCISE = '__none__';

/**
 * Ordered gap-fill/comprehension exercise list for an AUDIO lesson variant (BE1.3).
 * Full-replace on save, mirroring CueListEditor, but each row references an
 * Exercise (picked or created inline) rather than freeform text.
 */
export function ListeningStageListEditor({
  lessonId,
  variantId,
  container,
}: ListeningStageListEditorProps) {
  const t = useTranslations('Authoring');
  const { data: stages, isLoading } = useListeningStages(lessonId, variantId);
  const { data: exercises, isLoading: isExercisesLoading } = useAuthoringExercises(container.id);
  const [rows, setRows] = useState<StageRow[]>([]);
  const keyCounter = useRef(0);
  // Only safe to call from event handlers — mutates a ref, so never call
  // this while rendering (see the deterministic seed-batch keys below).
  function nextKey() {
    keyCounter.current += 1;
    return `stage-${keyCounter.current}`;
  }

  // Reseed from the server only when the stage count changes (e.g. on first
  // load) — not on every refetch, so in-flight edits survive query
  // invalidation. Adjusting state during render (not an effect) avoids the
  // extra commit + cascading render. Keys are derived from the seed batch
  // itself (not a mutated ref) since refs may not be touched during render.
  const [seededCount, setSeededCount] = useState<number | null>(null);
  if (stages && stages.length !== seededCount) {
    setSeededCount(stages.length);
    setRows(
      stages.map((s, i) => ({
        key: `stage-seed-${stages.length}-${i}`,
        exerciseId: s.exerciseId,
        stageType: s.stageType,
        creating: false,
      })),
    );
  }

  const autosave = useAutosave({
    onSave: async () => {
      if (!variantId) return;
      const entries = rows
        .filter((row) => row.exerciseId)
        .map((row, position) => ({
          position,
          exerciseId: row.exerciseId as string,
          stageType: row.stageType,
        }));
      const result = await saveListeningStagesAction(lessonId, variantId, entries);
      if (!result.ok) throw new Error(result.error.code);
    },
    debounceMs: 800,
  });

  function updateRow(key: string, patch: Partial<StageRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    autosave.schedule();
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey(), exerciseId: null, stageType: 'gap_fill', creating: false },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
    autosave.schedule();
  }

  function handleReorder(reordered: StageRow[]) {
    setRows(reordered);
    autosave.schedule();
  }

  if (!variantId) {
    return (
      <EditorCard title={t('editor.listeningStages')}>
        <p className="text-sm text-muted-foreground">{t('editor.listeningStagesNeedsSource')}</p>
      </EditorCard>
    );
  }

  if (isLoading || isExercisesLoading) {
    return (
      <EditorCard title={t('editor.listeningStages')}>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </EditorCard>
    );
  }

  return (
    <EditorCard
      title={t('editor.listeningStages')}
      right={<AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />}
    >
      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('editor.listeningStagesEmpty')}</p>
        )}

        <ReorderWithAnnouncer
          items={rows.map((row) => ({
            id: row.key,
            title: exercises?.find((e) => e.itemId === row.exerciseId)?.title ?? t('exercises.untitled'),
          }))}
          onReorder={(reorderedRefs) =>
            handleReorder(
              reorderedRefs.map((ref) => rows.find((row) => row.key === ref.id) as StageRow),
            )
          }
        >
          {(ref, position) => {
            const row = rows.find((r) => r.key === ref.id);
            if (!row) return null;
            return (
              <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-(--ssz-bg-base) p-3">
                <div className="flex items-center gap-2">
                  <Field label={t('editor.stageType')} htmlFor={`stage-type-${row.key}`} className="w-40">
                    <Select
                      value={row.stageType}
                      onValueChange={(value) => updateRow(row.key, { stageType: value as ListeningStageType })}
                    >
                      <SelectTrigger id={`stage-type-${row.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`editor.stageType${type === 'gap_fill' ? 'GapFill' : 'Comprehension'}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(row.key)}
                    aria-label={t('editor.stageRemove', { position })}
                    className="mt-auto mb-0.5 text-destructive hover:text-destructive"
                  >
                    <X aria-hidden />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={row.exerciseId ?? NO_EXERCISE}
                    onValueChange={(value) =>
                      updateRow(row.key, {
                        exerciseId: value === NO_EXERCISE ? null : value,
                        creating: false,
                      })
                    }
                  >
                    <SelectTrigger className="w-full" aria-label={t('editor.stageExerciseAriaLabel')}>
                      <SelectValue placeholder={t('editor.stageExerciseNone')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_EXERCISE}>{t('editor.stageExerciseNone')}</SelectItem>
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
                    onClick={() => updateRow(row.key, { creating: !row.creating })}
                  >
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t('editor.stageExerciseAddNew')}
                  </Button>
                </div>

                {row.creating && (
                  <ExerciseEditor
                    exerciseId={null}
                    container={container}
                    onClose={() => updateRow(row.key, { creating: false })}
                    onCreated={(exerciseId) => updateRow(row.key, { exerciseId, creating: false })}
                  />
                )}
              </div>
            );
          }}
        </ReorderWithAnnouncer>

        <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t('editor.stageAdd')}
        </Button>
      </div>
    </EditorCard>
  );
}
