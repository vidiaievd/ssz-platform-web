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
/** The floor a field column may not shrink past (`.ss-field{min-width:104px}`). */
const MIN_COLUMN = 104;
const COLUMN_GAP = 6;

/**
 * Whether this many fields can be drawn as columns in this much width.
 *
 * The layout is a question of arithmetic, not of screen size, and asking it the other way
 * round is what makes a board irritating: a fixed breakpoint says "wide enough for
 * columns" about a container that then has to scroll sideways, because a seven-field
 * schema needs 728px and a four-field one needs 416px. Below the fit, the rows layout is
 * not a fallback — it is the better drawing, one field per line with nothing cut off.
 */
export function fitsAsColumns(width: number, fieldCount: number): boolean {
  if (fieldCount === 0) return true;
  return width >= fieldCount * MIN_COLUMN + (fieldCount - 1) * COLUMN_GAP;
}
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
    <div
      className={
        cols ? 'flex items-stretch gap-1.5 overflow-x-auto p-0.5' : 'flex flex-col gap-1.5 p-0.5'
      }
    >
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

        /*
          Key and name share one baseline as columns and stack as rows (`.ss-fhead` and
          its `data-layout="rows"` override). The name truncates rather than wraps, and
          that is load-bearing rather than cosmetic: a column is `flex: 1 1 0`, so text
          allowed to set its own width would push every other field along and turn the
          board into a horizontal scroller — which is exactly what a chart must not be.
        */
        const head = (
          <div
            className={
              cols ? 'flex min-w-0 items-baseline gap-1.5' : 'flex min-w-0 shrink-0 flex-col gap-px'
            }
          >
            <span
              className="shrink-0 font-mono text-[11px] font-bold"
              style={{ color: 'var(--ssz-color-primary-600)' }}
            >
              {field.short}
            </span>
            {labels && field.label !== '' && (
              <span
                className={`text-[11px] leading-tight ${cols ? 'min-w-0 truncate' : ''}`}
                style={{ color: 'var(--ssz-text-secondary)' }}
                title={cols ? field.label : undefined}
              >
                {field.label}
              </span>
            )}
            {counts?.[field.id] !== undefined && (
              <em
                className={`not-italic font-mono text-[10px] ${cols ? 'ml-auto shrink-0' : ''}`}
                style={{ color: 'var(--ssz-text-muted)' }}
              >
                {counts[field.id]}
              </em>
            )}
          </div>
        );

        /*
          The author's one-line explanation, and the piece the two layouts disagree about.
          As columns it is a line of its own between the head and the cell (`.ss-fhint`).
          As rows it cannot go in the 96px label column — a sentence wrapped into three
          lines there is what makes every field on a phone twice as tall as the box the
          learner is aiming at — so it spans the whole field underneath instead.

          The handoff has no answer here: its own default is `hints: false`, and its rows
          grid is written for exactly two children. An author who turns hints on is not
          asking for a broken board, so this is the missing case rather than a departure.
        */
        const hint = hints && field.hint !== '' && (
          <p className="m-0 text-[10px] leading-[1.35]" style={{ color: 'var(--ssz-text-muted)' }}>
            {field.hint}
          </p>
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
            className="flex flex-1 flex-wrap content-start items-center gap-1.5 rounded-md p-[7px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{
              minHeight: TAP_MIN,
              // Dashed until the sentence is marked, filled or not (`.ss-fcell`, and
              // `.ss-field[data-mark] .ss-fcell{border-style:solid}`). The dashed edge is
              // what says "this is a slot"; turning it solid the moment a word lands makes
              // seven quiet outlines into seven boxes, which is the whole difference
              // between reading a chart and reading a form.
              borderWidth: 1.5,
              borderStyle: tone === null ? 'dashed' : 'solid',
              borderColor: tone?.line ?? (armed || dragOver ? accent : 'var(--ssz-border-strong)'),
              background:
                tone?.bg ??
                (armed || dragOver ? 'var(--ssz-runner-practice-soft)' : 'var(--ssz-bg-base)'),
              cursor: readOnly ? 'default' : 'pointer',
            }}
          >
            {ids.length === 0
              ? // Only an optional field says it is meant to be empty. A required one
                // stays blank, so its emptiness cannot be read as a clue.
                field.optional && (
                  <span
                    aria-hidden="true"
                    className="mx-auto self-center text-[13px]"
                    style={{ color: 'var(--ssz-text-muted)' }}
                  >
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
                      className="inline-flex max-w-full items-center gap-1 rounded-md px-[9px] py-[5px] text-[14px]"
                      style={{
                        fontFamily: READING,
                        // `.ss-tok`: a filled chip, no border. The border was doing the
                        // work the fill is meant to do, and paying for it twice — a
                        // rectangle inside a rectangle, seven times over.
                        background: wrong
                          ? NO_BG
                          : itemMark === 'ok'
                            ? OK_BG
                            : 'var(--ssz-color-primary-100)',
                        color: wrong
                          ? 'var(--ssz-color-error-700)'
                          : itemMark === 'ok'
                            ? 'var(--ssz-color-success-700)'
                            : 'var(--ssz-color-primary-800)',
                        // Never colour alone: a wrong piece is boxed as well as tinted,
                        // and the box is an inset ring so it costs no layout.
                        boxShadow: wrong ? `inset 0 0 0 1px ${NO_LINE}` : undefined,
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
                          className="grid size-[15px] shrink-0 place-items-center rounded-full opacity-50 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                          style={{ color: 'inherit' }}
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
          // `flex-1 basis-0` with a floor of 104px, straight from `.ss-field`: the fields
          // share the width they have instead of each claiming what its text wants.
          <div key={field.id} className="flex min-w-[104px] flex-1 basis-0 flex-col gap-1.5">
            {head}
            {hint}
            {cell}
          </div>
        ) : (
          // `96px | minmax(0,1fr)`, vertically centred — the head reads as a label beside
          // the box rather than as a heading above it. The hint, when there is one, takes
          // the line below across both columns.
          <div
            key={field.id}
            className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-2 gap-y-1"
          >
            {head}
            {cell}
            {hint !== false && <div className="col-span-2">{hint}</div>}
          </div>
        );
      })}
    </div>
  );
}
