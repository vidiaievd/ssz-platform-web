'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { Field, FieldMark, ItemMark, Placement } from '@/lib/shared-kernel/sentence-schema';

/** How the fields are laid out: side by side, or stacked one per row. */
export type BoardLayout = 'cols' | 'rows';

export interface SchemaBoardProps {
  /** The fields of this sentence's clause type, in the order the board reads. */
  fields: Field[];
  /** What is currently in each field, in the order it was stacked. */
  placement: Placement;
  /** The text of a piece, by id. Pieces on the board are drawn, never looked up twice. */
  textOf: (itemId: string) => string;
  layout: BoardLayout;
  /** Show the field's full name under its short key. */
  labels: boolean;
  /** Show the author's one-line hint per field. */
  hints: boolean;
  /** Expected chunks per field, when the author turned counts on. */
  counts: Record<string, number> | null;
  /** The server's marks, once the sentence has been checked. Cleared by any placement. */
  marks: { byItem: Record<string, ItemMark>; byField: Record<string, FieldMark> | null } | null;
  /** The field waiting for a piece, in the tap-a-field-then-tap-a-word path. */
  selectedField: string | null;
  onFieldPress?: (fieldId: string) => void;
  /** Take a piece back to the bank. */
  onRemove?: (itemId: string) => void;
  /** A piece was dragged onto a field — from the bank, or from another field. */
  onDropItem?: (itemId: string, fieldId: string) => void;
  /** Nothing accepts input: the sentence is solved, revealed, or this is a preview. */
  readOnly?: boolean;
  accent: string;
}

const TAP_MIN = 44;
const READING = 'var(--ssz-font-reading)';
const OK_BG = 'var(--ssz-feedback-ok-bg)';
const OK_LINE = 'var(--ssz-feedback-ok-line)';
const NO_BG = 'var(--ssz-feedback-no-bg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';

/**
 * The topological field board — the one component both sides of this exercise are made
 * of, and the first thing IMPLEMENTATION.md says to build.
 *
 * It draws fields and what is in them, and it knows nothing about grading, attempts or
 * where the pieces came from. That is what lets the same component serve the student's
 * runner, the builder's live preview and the read-only board over the schema editor —
 * three screens that would otherwise drift into three boards.
 *
 * Two layouts, one component. **Columns** where there is room: the fields side by side,
 * scrolling horizontally, which is the picture the model is *about* — "the finite verb is
 * in the second field" is a claim about a row of boxes. **Rows** on a phone, where four
 * columns leave each one too narrow to hold a word: the field key and its cell on one
 * line, `96px | 1fr`. The layout is passed in rather than measured here, because the
 * teacher's preview renders this inside a 284px phone frame on a desktop screen.
 *
 * Three things that look like styling and are not:
 *
 * - **An empty field renders `—` only when it may legitimately stay empty.** A required
 *   field left empty renders nothing at all, so that its emptiness is not a hint that
 *   something belongs there (BEHAVIOR, "Empty and edge states").
 * - **A used piece is `aria-disabled`, not merely faded.** Opacity is invisible to a
 *   screen reader, and the pieces are the whole exercise.
 * - **`byField` may be absent while `byItem` is not.** The author can turn per-field
 *   marking off; the sentence still gets a verdict, only the board stops colouring where
 *   the mistake is.
 */
export function SchemaBoard({
  fields,
  placement,
  textOf,
  layout,
  labels,
  hints,
  counts,
  marks,
  selectedField,
  onFieldPress,
  onRemove,
  onDropItem,
  readOnly = false,
  accent,
}: SchemaBoardProps) {
  const t = useTranslations('ExerciseRunner');
  const [over, setOver] = useState<string | null>(null);

  const cols = layout === 'cols';

  return (
    <div className={cols ? 'flex snap-x gap-2 overflow-x-auto pb-1' : 'flex flex-col gap-1.5'}>
      {fields.map((field) => {
        const ids = placement[field.id] ?? [];
        const fieldMark = marks?.byField?.[field.id];
        const tone =
          fieldMark === undefined || fieldMark === 'empty'
            ? null
            : fieldMark === 'ok'
              ? { bg: OK_BG, line: OK_LINE }
              : { bg: NO_BG, line: NO_LINE };
        const armed = selectedField === field.id;
        const dragOver = over === field.id;

        const head = (
          <div className={cols ? 'mb-1 flex flex-col gap-0.5' : 'flex shrink-0 flex-col'}>
            <span className="flex items-baseline gap-1">
              <span
                className="font-mono text-[12.5px] font-bold"
                style={{ color: 'var(--ssz-text-muted)' }}
              >
                {field.short}
              </span>
              {counts?.[field.id] !== undefined && (
                <em className="text-[11px] not-italic" style={{ color: 'var(--ssz-text-muted)' }}>
                  {counts[field.id]}
                </em>
              )}
            </span>
            {labels && field.label !== '' && (
              <span
                className="text-[11.5px] leading-tight"
                style={{ color: 'var(--ssz-text-muted)' }}
              >
                {field.label}
              </span>
            )}
            {hints && field.hint !== '' && (
              <span
                className="text-[11px] leading-tight"
                style={{ color: 'var(--ssz-text-subtle)' }}
              >
                {field.hint}
              </span>
            )}
          </div>
        );

        const cell = (
          <div
            // Read-only means there is nothing to press, so the cell stops being a
            // button altogether rather than becoming a disabled one: a locked board is
            // not a control the learner is being refused, it is a picture of the answer.
            role={readOnly ? undefined : 'button'}
            tabIndex={readOnly ? undefined : 0}
            {...(readOnly
              ? {}
              : {
                  'aria-label': t('sentenceSchema.fieldDropLabel', {
                    field: field.label || field.short,
                  }),
                })}
            onClick={() => !readOnly && onFieldPress?.(field.id)}
            onKeyDown={(event) => {
              if (readOnly) return;
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onFieldPress?.(field.id);
            }}
            onDragOver={(event) => {
              if (readOnly) return;
              event.preventDefault();
              setOver(field.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              setOver(null);
              if (readOnly) return;
              event.preventDefault();
              const dropped = event.dataTransfer.getData('text/plain');
              if (dropped !== '') onDropItem?.(dropped, field.id);
            }}
            className="flex flex-1 flex-wrap content-start items-start gap-1 rounded-lg border px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{
              minHeight: TAP_MIN,
              background:
                tone?.bg ??
                (armed || dragOver ? 'var(--ssz-runner-practice-soft)' : 'var(--ssz-bg-surface)'),
              borderColor: tone?.line ?? (armed || dragOver ? accent : 'var(--ssz-border-default)'),
              borderStyle: ids.length === 0 && !armed && !dragOver ? 'dashed' : 'solid',
              cursor: readOnly ? 'default' : 'pointer',
            }}
          >
            {ids.length === 0
              ? // Only an optional field says it is meant to be empty. A required one
                // stays blank, so its emptiness cannot be read as a clue.
                field.optional && (
                  <span aria-hidden="true" style={{ color: 'var(--ssz-text-subtle)' }}>
                    —
                  </span>
                )
              : ids.map((itemId) => {
                  const itemMark = marks?.byItem[itemId];
                  const wrong = itemMark !== undefined && itemMark !== 'ok';
                  return (
                    <span
                      key={itemId}
                      draggable={!readOnly}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.setData('text/plain', itemId);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[14px]"
                      style={{
                        fontFamily: READING,
                        minHeight: readOnly ? undefined : 32,
                        background: wrong ? NO_BG : 'var(--ssz-bg-elevated)',
                        // Never colour alone: a wrong piece is boxed as well as tinted.
                        borderColor: wrong ? NO_LINE : 'var(--ssz-border-default)',
                        borderWidth: wrong ? 2 : 1,
                        color: 'var(--ssz-text-primary)',
                      }}
                    >
                      {textOf(itemId)}
                      {!readOnly && onRemove !== undefined && (
                        <button
                          type="button"
                          aria-label={t('sentenceSchema.takeBack', { word: textOf(itemId) })}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(itemId);
                          }}
                          className="rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                          style={{ color: 'var(--ssz-text-muted)' }}
                        >
                          <X size={11} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  );
                })}
          </div>
        );

        return cols ? (
          <div
            key={field.id}
            className="flex shrink-0 snap-start flex-col"
            style={{ minWidth: 104 }}
          >
            {head}
            {cell}
          </div>
        ) : (
          <div key={field.id} className="flex items-stretch gap-2">
            <div className="flex w-24 shrink-0 items-start pt-1.5">{head}</div>
            {cell}
          </div>
        );
      })}
    </div>
  );
}
