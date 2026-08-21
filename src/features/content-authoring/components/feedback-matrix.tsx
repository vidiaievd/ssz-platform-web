'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

/**
 * One row of the matrix: something a student can get wrong, with the column that is its
 * own correct answer and can therefore never hold an explanation.
 */
export interface MatrixRow {
  id: string;
  /** Plain text, for the accessible names. */
  label: string;
  /** What the row's sticky header cell shows — usually the item with its answer marked. */
  header: ReactNode;
  answerColumnId: string;
}

export interface MatrixColumn {
  id: string;
  label: string;
}

/**
 * Every word the matrix says, supplied by the caller.
 *
 * The component holds no strings of its own: it serves two exercise types whose rows are
 * different things ("gap G2" against "the pair starting *Hvis det regner*"), and the
 * teacher UI is translated into four languages. Sentences belong to the type that knows
 * what its rows are.
 */
export interface MatrixCopy {
  caption: string;
  rowColumn: string;
  legend: string;
  answerShort: string;
  answerCell: (row: string, column: string) => string;
  writeCell: (row: string, column: string) => string;
  editCell: (row: string, column: string) => string;
  editorTitle: (row: string, column: string) => string;
  position: (at: number, of: number) => string;
  previousCell: string;
  nextCell: string;
  closeEditor: string;
  shortcutHint: string;
}

export interface FeedbackMatrixProps {
  rows: MatrixRow[];
  columns: MatrixColumn[];
  copy: MatrixCopy;
  /** Authored text for one cell; the empty string when nothing is written. */
  textFor: (rowId: string, columnId: string) => string;
  onCellChange: (rowId: string, columnId: string, text: string) => void;
  /**
   * What the student would be told if this row's cell stayed empty — the row's default
   * explanation, shown as the field's placeholder so the choice to leave it empty is an
   * informed one (AC-B22 here, AC-B21 in gap-fill).
   */
  placeholderFor: (rowId: string) => string;
  /** Reading face for the content columns, where the content is the target language. */
  columnFont?: string | undefined;
  disabled?: boolean;
  /**
   * Rendered above the field of the open cell: what the sentence being built looks like,
   * and the AI draft panel where there is one. The row's sticky header is not repeated
   * here — it is a table cell, sized for a column, and the editor has room to say more.
   */
  renderCellExtra?: ((rowId: string, columnId: string) => ReactNode) | undefined;
  /** Rendered beside the shortcut hint under the field. */
  editorFooter?: ReactNode;
}

/** One writable cell. A row's own answer column never becomes one. */
interface Cell {
  row: MatrixRow;
  column: MatrixColumn;
}

/**
 * Every row against every column, with an editor for the cell in hand.
 *
 * This is what makes per-cell authoring survive a real pool: five pairs against eight
 * halves is thirty-five cells, and the by-row list is the wrong tool for seeing which of
 * them are written. The list is where one row's feedback is written carefully; this is
 * where a run of cells is filled in without leaving the keyboard.
 *
 * Shared by `word_bank_gap_fill` and `match_pairs`, which differ in what a row and a
 * column *are* and in nothing else about this screen. Extracted when the second type
 * needed it (plan 49, phase 6) rather than copied, because the parts worth having — the
 * `‹ n / total ›` walk in document order, focus following the cell, the scroll living
 * inside the table — are exactly the parts a copy drifts on.
 */
export function FeedbackMatrix({
  rows,
  columns,
  copy,
  textFor,
  onCellChange,
  placeholderFor,
  columnFont,
  disabled = false,
  renderCellExtra,
  editorFooter,
}: FeedbackMatrixProps) {
  /** Document order, row by row — the order `‹ ›` and Cmd/Ctrl+Enter walk. */
  const cells = useMemo(
    () =>
      rows.flatMap((row) =>
        columns
          .filter((column) => column.id !== row.answerColumnId)
          .map((column) => ({ row, column })),
      ),
    [rows, columns],
  );

  const [activeAt, setActiveAt] = useState<number | null>(null);
  const active = activeAt === null ? undefined : cells[activeAt];

  function openCell(rowId: string, columnId: string) {
    const at = cells.findIndex((cell) => cell.row.id === rowId && cell.column.id === columnId);
    setActiveAt(at === -1 ? null : at);
  }

  function step(direction: -1 | 1) {
    setActiveAt((current) => {
      if (current === null) return null;
      const next = current + direction;
      return next < 0 || next >= cells.length ? current : next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The scroll lives here, not on the page (BEHAVIOR §5). */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-max border-collapse text-sm">
          <caption className="sr-only">{copy.caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                {copy.rowColumn}
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="min-w-24 px-3 py-2 text-left text-xs font-medium"
                  style={{ fontFamily: columnFont }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-3 py-2 text-left align-top"
                >
                  {row.header}
                </th>

                {columns.map((column) => {
                  // The cell where a row meets its own answer can never hold an
                  // explanation — there is nothing wrong to explain there. That is what
                  // the row's `why` is for, over in the list view.
                  if (column.id === row.answerColumnId) {
                    return (
                      <td key={column.id} className="px-3 py-2 text-center">
                        <span
                          className="inline-flex items-center gap-1 text-xs text-primary"
                          title={copy.answerCell(row.label, column.label)}
                        >
                          <Check className="size-3.5" aria-hidden />
                          <span className="sr-only">
                            {copy.answerCell(row.label, column.label)}
                          </span>
                          {copy.answerShort}
                        </span>
                      </td>
                    );
                  }

                  const written = textFor(row.id, column.id).trim() !== '';
                  const isActive = active?.row.id === row.id && active.column.id === column.id;

                  return (
                    <td key={column.id} className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={
                          written
                            ? copy.editCell(row.label, column.label)
                            : copy.writeCell(row.label, column.label)
                        }
                        aria-pressed={isActive}
                        onClick={() => openCell(row.id, column.id)}
                        className={`inline-flex size-7 items-center justify-center rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:shadow-focus-primary ${
                          isActive ? 'border-primary ring-1 ring-primary' : ''
                        } ${
                          written
                            ? 'border-success-300 bg-success-50 text-success-700'
                            : 'border-dashed border-border text-muted-foreground hover:bg-[var(--ssz-bg-subtle)]'
                        }`}
                      >
                        {written ? <Check className="size-3.5" aria-hidden /> : '·'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{copy.legend}</p>

      {active !== undefined && (
        <CellEditor
          cell={active}
          copy={copy}
          position={{ at: (activeAt ?? 0) + 1, of: cells.length }}
          text={textFor(active.row.id, active.column.id)}
          placeholder={placeholderFor(active.row.id)}
          disabled={disabled}
          extra={renderCellExtra?.(active.row.id, active.column.id)}
          footer={editorFooter}
          onChange={(text) => onCellChange(active.row.id, active.column.id, text)}
          onStep={step}
          onClose={() => setActiveAt(null)}
        />
      )}
    </div>
  );
}

interface CellEditorProps {
  cell: Cell;
  copy: MatrixCopy;
  position: { at: number; of: number };
  text: string;
  placeholder: string;
  disabled: boolean;
  extra: ReactNode;
  footer: ReactNode;
  onChange: (text: string) => void;
  onStep: (direction: -1 | 1) => void;
  onClose: () => void;
}

/**
 * The editor for one cell, under the table.
 *
 * Under, not in a dialog: the point of this view is writing many cells in a row, and a
 * modal that has to be dismissed between them would make the matrix slower than the list
 * it exists to beat.
 */
function CellEditor({
  cell,
  copy,
  position,
  text,
  placeholder,
  disabled,
  extra,
  footer,
  onChange,
  onStep,
  onClose,
}: CellEditorProps) {
  const field = useRef<HTMLTextAreaElement | null>(null);

  // Focus follows the cell, including when `‹ ›` moves to the next one: the teacher
  // should be typing, not hunting for the field again.
  useEffect(() => {
    field.current?.focus();
  }, [cell.row.id, cell.column.id]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">
          {copy.editorTitle(cell.row.label, cell.column.label)}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {copy.position(position.at, position.of)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || position.at === 1}
          aria-label={copy.previousCell}
          onClick={() => onStep(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || position.at === position.of}
          aria-label={copy.nextCell}
          onClick={() => onStep(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copy.closeEditor}
          onClick={onClose}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {extra}

      <Textarea
        ref={field}
        rows={3}
        value={text}
        disabled={disabled}
        aria-label={copy.editCell(cell.row.label, cell.column.label)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
          event.preventDefault();
          onStep(1);
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{copy.shortcutHint}</p>
        {footer}
      </div>
    </div>
  );
}
