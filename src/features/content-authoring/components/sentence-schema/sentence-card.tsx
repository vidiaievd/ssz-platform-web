'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Merge, Split, Target, Trash2, X } from 'lucide-react';

import { useContainerWidth } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fieldsFor,
  isDeliverable,
  solution,
  type ClauseId,
  type Row,
} from '@/lib/shared-kernel/sentence-schema';
import { fitsAsColumns, SchemaBoard } from '@/features/student/exercises/runner/schema-board';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

import {
  addExtra,
  assignChunk,
  joinAt,
  removeExtra,
  setRowClause,
  setRowSource,
  setRowText,
  splitAt,
  toggleAlt,
  unassignChunk,
  type SentenceSchemaDocument,
} from './edits';

export interface SentenceCardProps {
  exercise: SentenceSchemaDocument;
  row: Row;
  index: number;
  onChange: (next: SentenceSchemaDocument) => void;
  onRemove: () => void;
  canDelete: boolean;
}

/**
 * One sentence of the set — the three coupled layers that make this the hardest screen in
 * the builder, and the reason IMPLEMENTATION.md says to build step 2 first.
 *
 * The layers are one thing seen three ways, top to bottom:
 *
 * 1. **the text** — the sentence as the student must end up with it. Every keystroke
 *    re-tokenizes it, and placements survive wherever the words do (`edits.setRowText` →
 *    the kernel's `retokenize`). A teacher fixing a typo after placing eight chunks keeps
 *    all eight.
 * 2. **the chunk strip** — the same words, joinable. `I` + `morgen` → `I morgen` is how
 *    "one element" in the V2 sense gets said, and it is the only way the Forfelt rule
 *    becomes checkable.
 * 3. **the board** — where each chunk belongs. This placement *is* the answer key and the
 *    word bank at once; there is no second array to keep in step with it.
 *
 * Selection lives in the strip rather than on the board, which is the one place this
 * departs from the prototype's arrangement while keeping its contract ("select a placed
 * chunk → the alternatives strip appears"). The reason is keyboard access: a placed chunk
 * already carries a × button, and a piece that were itself a button with a button inside
 * it is either invalid markup or a pointer-only affordance. The strip is made of real
 * buttons, so every chunk — placed or not — is selectable by keyboard.
 */
export function SentenceCard({
  exercise,
  row,
  index,
  onChange,
  onRemove,
  canDelete,
}: SentenceCardProps) {
  const t = useTranslations('Authoring');
  const [board, width] = useContainerWidth();
  const [selected, setSelected] = useState<string | null>(null);
  const [extraDraft, setExtraDraft] = useState('');

  const seq = exercise.settings.orderOnly;
  const fields = fieldsFor(exercise, row);
  const placement = solution(row);
  const unplaced = row.chunks.filter((chunk) => chunk.field === null);
  const complete = isDeliverable(row, seq);
  const written = row.text.trim() !== '';
  const selectedChunk = row.chunks.find((chunk) => chunk.id === selected) ?? null;
  const placedSomething = row.chunks.some((chunk) => chunk.field !== null);

  const textOf = (itemId: string) => row.chunks.find((c) => c.id === itemId)?.text ?? '';

  /** Tapping a field with a chunk selected is the keyboard path onto the board. */
  const pressField = (fieldId: string) => {
    if (selected === null) return;
    onChange(assignChunk(exercise, row.id, selected, fieldId));
    setSelected(null);
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border bg-surface p-4 ${
        written && !complete ? 'border-warning-500' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)">
          {index + 1}
        </span>

        {/* The clause type picks a field list, and sequence-only has none to pick. */}
        {!seq && (
          <Select
            value={row.clause}
            onValueChange={(clause) => onChange(setRowClause(exercise, row.id, clause as ClauseId))}
          >
            <SelectTrigger className="h-8 w-44" aria-label={t('sentenceSchema.step2.clauseLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exercise.clauses.map((clause) => (
                <SelectItem key={clause} value={clause}>
                  {t(`sentenceSchema.clause.${clause}` as 'sentenceSchema.clause.main')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="grow" />

        {complete ? (
          <span className="flex items-center gap-1 text-xs text-success-700">
            <Check className="size-3.5" aria-hidden />
            {t('sentenceSchema.step2.complete')}
          </span>
        ) : (
          written &&
          !seq && (
            <span className="text-xs text-warning-700">
              {t('sentenceSchema.step2.wordsLeft', { count: unplaced.length })}
            </span>
          )
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canDelete}
          aria-label={t('sentenceSchema.step2.deleteSentence')}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {/*
        The warning has to be readable *before* the select is touched, not after: changing
        the clause type clears every placement in this sentence and there is no undo for it
        (plan 52 §6.1, BEHAVIOR "a warning callout is visible before the click").
      */}
      {!seq && placedSomething && exercise.clauses.length > 1 && (
        <p className="flex items-start gap-1.5 text-xs text-warning-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('sentenceSchema.step2.clauseWarning')}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t('sentenceSchema.step2.textLabel')}</span>
        <Input
          value={row.text}
          placeholder={t('sentenceSchema.step2.textPlaceholder')}
          onChange={(event) => onChange(setRowText(exercise, row.id, event.target.value))}
        />
      </label>

      {/*
        The prompt of a transformation task (plan 52 §3.8). Deliberately a plain input with
        no machinery behind it: it is never tokenized, never banked and never graded, and a
        field that looked like the sentence field would invite exactly that mistake.
      */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`ss-source-${row.id}`}>
          {t('sentenceSchema.step2.sourceLabel')}
        </label>
        <Input
          id={`ss-source-${row.id}`}
          aria-describedby={`ss-source-help-${row.id}`}
          value={row.source}
          placeholder={t('sentenceSchema.step2.sourcePlaceholder')}
          onChange={(event) => onChange(setRowSource(exercise, row.id, event.target.value))}
        />
        <p id={`ss-source-help-${row.id}`} className="text-xs text-muted-foreground">
          {t('sentenceSchema.step2.sourceHelp')}
        </p>
      </div>

      {row.chunks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('sentenceSchema.step2.chunksLabel')}</span>
          <div className="flex flex-wrap items-center gap-0.5">
            {row.chunks.map((chunk, position) => (
              <div key={chunk.id} className="flex items-center">
                <span className="inline-flex items-center rounded-md border">
                  <button
                    type="button"
                    // Named rather than left to its text: the unplaced pills below the
                    // board carry the same words, and two buttons a screen reader calls
                    // "skal" are two buttons nobody can tell apart.
                    aria-label={t('sentenceSchema.step2.selectChunk', { word: chunk.text })}
                    aria-pressed={selected === chunk.id}
                    onClick={() => setSelected(selected === chunk.id ? null : chunk.id)}
                    className={`rounded-l-md px-2 py-1 text-sm ${
                      selected === chunk.id
                        ? 'bg-(--ssz-color-primary-600) text-white'
                        : chunk.field !== null
                          ? 'bg-(--ssz-color-primary-50) text-(--ssz-color-primary-700) dark:bg-(--ssz-color-primary-950)'
                          : 'bg-surface'
                    }`}
                  >
                    {chunk.text}
                  </button>
                  {chunk.text.includes(' ') && (
                    <button
                      type="button"
                      aria-label={t('sentenceSchema.step2.split')}
                      title={t('sentenceSchema.step2.split')}
                      onClick={() => onChange(splitAt(exercise, row.id, position))}
                      className="border-l px-1.5 py-1 text-muted-foreground hover:text-foreground"
                    >
                      <Split className="size-3" aria-hidden />
                    </button>
                  )}
                </span>
                {position < row.chunks.length - 1 && (
                  <button
                    type="button"
                    aria-label={t('sentenceSchema.step2.join')}
                    title={t('sentenceSchema.step2.join')}
                    onClick={() => onChange(joinAt(exercise, row.id, position))}
                    className="mx-0.5 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Merge className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {row.chunks.length > 0 && !seq && (
        <div ref={board} className="flex flex-col gap-2">
          <span className="text-xs font-medium">{t('sentenceSchema.step2.boardLabel')}</span>

          <SchemaBoard
            fields={fields}
            placement={placement}
            textOf={textOf}
            layout={fitsAsColumns(width, fields.length) ? 'cols' : 'rows'}
            labels
            hints={false}
            counts={null}
            marks={null}
            selectedField={null}
            onFieldPress={pressField}
            onRemove={(itemId) => onChange(unassignChunk(exercise, row.id, itemId))}
            onDropItem={(itemId, fieldId) =>
              onChange(assignChunk(exercise, row.id, itemId, fieldId))
            }
            accent={PRACTICE_ACCENT}
          />

          {unplaced.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {unplaced.map((chunk) => (
                <button
                  key={chunk.id}
                  type="button"
                  draggable
                  aria-pressed={selected === chunk.id}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', chunk.id)}
                  onClick={() => setSelected(selected === chunk.id ? null : chunk.id)}
                  className={`rounded-md border px-2 py-1 text-sm ${
                    selected === chunk.id
                      ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-600) text-white'
                      : 'border-border bg-surface'
                  }`}
                >
                  {chunk.text}
                </button>
              ))}
              <span className="text-xs text-muted-foreground">
                {t('sentenceSchema.step2.unassignedHelp')}
              </span>
            </div>
          )}

          {/*
            How adverbial fronting is modelled: one chunk accepted in two fields, rather
            than a second full layout of the same sentence. Its own field is not offered —
            a field that were both the answer and an alternative says nothing.
          */}
          {selectedChunk !== null && selectedChunk.field !== null && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-(--ssz-border-default) bg-subtle p-3">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Target className="size-3.5" aria-hidden />
                {t('sentenceSchema.step2.altTitle', { chunk: selectedChunk.text })}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {fields
                  .filter((field) => field.id !== selectedChunk.field)
                  .map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      aria-pressed={selectedChunk.alt.includes(field.id)}
                      onClick={() =>
                        onChange(toggleAlt(exercise, row.id, selectedChunk.id, field.id))
                      }
                      className={`rounded-full border border-dashed px-2.5 py-1 text-xs ${
                        selectedChunk.alt.includes(field.id)
                          ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) text-(--ssz-color-primary-700) dark:bg-(--ssz-color-primary-950)'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {field.short} · {field.label}
                    </button>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('sentenceSchema.step2.altHelp')}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">{t('sentenceSchema.step2.extrasLabel')}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.extras.map((extra) => (
            <span
              key={extra.id}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-error px-2.5 py-1 text-xs text-error"
            >
              {extra.text}
              <button
                type="button"
                aria-label={t('sentenceSchema.step2.removeExtra', { text: extra.text })}
                onClick={() => onChange(removeExtra(exercise, row.id, extra.id))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <Input
            className="h-8 w-52"
            value={extraDraft}
            placeholder={t('sentenceSchema.step2.extrasPlaceholder')}
            aria-label={t('sentenceSchema.step2.extrasLabel')}
            onChange={(event) => setExtraDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || extraDraft.trim() === '') return;
              event.preventDefault();
              onChange(addExtra(exercise, row.id, extraDraft));
              setExtraDraft('');
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('sentenceSchema.step2.extrasHelp')}</p>
      </div>
    </div>
  );
}
