'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ClipboardPaste, Info, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { withSegment } from '@/lib/shared-kernel/audio';

import { AudioSegmentField } from '../audio';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  audit,
  balance,
  isAnswered,
  parseBulk,
  readyRows,
  type Issue,
} from '@/lib/shared-kernel/multiple-choice-group';

import {
  addRow,
  applyBulkPaste,
  markAnswer,
  MIN_ROWS,
  removeRow,
  setRow,
  type MultipleChoiceGroupDocument,
} from './edits';
import { useIssueCopy } from './issue-copy';

/** The stacked bar's colours, in column order. Four columns is the model's ceiling. */
const SHADES = [
  'var(--ssz-color-primary-500)',
  'var(--ssz-color-warning-500)',
  'var(--ssz-color-info-500, var(--ssz-color-primary-300))',
  'var(--ssz-border-strong)',
];

export interface StepStatementsProps {
  exercise: MultipleChoiceGroupDocument;
  onChange: (next: MultipleChoiceGroupDocument) => void;
  /** The course's language. Decides which audit checks can speak (kernel `language.ts`). */
  language: string;
}

/**
 * Step 2: the statements and the shared key — where a teacher spends most of their time.
 *
 * One grid, one row per claim, and the answer marked as the statement is written. That
 * ordering is the point of the type: the key is shared, so marking it is a click on the
 * row rather than a trip to another screen, and a table whose key is written last is a
 * table written twice.
 *
 * Every message on this screen is the kernel's — the row-level audit flags, the "no answer
 * marked" error, the balance the strip reports. This component decides where each one is
 * drawn and nothing about whether it is true, which is what keeps it, the rail and the
 * publish preflight from disagreeing about the same table.
 *
 * The balance strip earns its place here rather than in the gate. README calls a lopsided
 * key the failure mode of this exercise type, and it is: a Riktig/Galt table where nine of
 * ten rows are «Riktig» is passed by a student who never opened the text. Seeing the bar
 * fill up on one side while writing is what stops that being discovered at the end.
 */
export function StepStatements({ exercise, onChange, language }: StepStatementsProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);
  const [bulkOpen, setBulkOpen] = useState(false);

  const flags = audit(exercise, { language });
  const rowFlags = (rowId: string): Issue[] =>
    flags.filter((flag) => 'rowId' in flag && flag.rowId === rowId);
  const groupFlags = flags.filter((flag) => !('rowId' in flag));

  const spread = balance(exercise);
  const ready = readyRows(exercise);
  const columns = exercise.columns;
  const timecodes = exercise.audio.audio.enabled && exercise.audio.audio.useSegments;
  const grid = {
    gridTemplateColumns: `28px minmax(0,1fr) repeat(${columns.length}, 84px) 40px`,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('multipleChoiceGroup.step2.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('multipleChoiceGroup.step2.lede')}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
          <ClipboardPaste className="size-4" aria-hidden />
          {t('multipleChoiceGroup.step2.bulkOpen')}
        </Button>
      </div>

      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-semibold tabular-nums">
          {t('multipleChoiceGroup.step2.ready', {
            count: ready.length,
            total: exercise.rows.length,
          })}
        </p>
        <div className="flex-1">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
            {spread.counts.map((count, at) => (
              <span
                key={count.column.id}
                className="h-full"
                style={{
                  width: `${spread.total === 0 ? 0 : (count.n / spread.total) * 100}%`,
                  background: SHADES[at % SHADES.length],
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {spread.counts.map((count, at) => (
              <span key={count.column.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: SHADES[at % SHADES.length] }}
                />
                {count.column.label.trim() === ''
                  ? t('multipleChoiceGroup.step2.unnamedColumn')
                  : count.column.label}{' '}
                · {count.n}
              </span>
            ))}
          </p>
        </div>
      </section>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div
            className="grid items-center gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground"
            style={grid}
          >
            <span>{t('multipleChoiceGroup.step2.indexHeader')}</span>
            <span>{t('multipleChoiceGroup.step2.statementHeader')}</span>
            {columns.map((column) => (
              <span key={column.id} className="text-center">
                {column.label.trim() === ''
                  ? t('multipleChoiceGroup.step2.unnamedColumn')
                  : column.label}
              </span>
            ))}
            <span />
          </div>

          <ul className="flex flex-col gap-1.5">
            {exercise.rows.map((row, index) => {
              const missingAnswer = row.text.trim() !== '' && !isAnswered(exercise, row);
              const notes = rowFlags(row.id);

              return (
                <li
                  key={row.id}
                  className={`rounded-lg border px-1 py-1.5 ${
                    missingAnswer ? 'border-error bg-error-50/40' : 'border-transparent'
                  }`}
                >
                  <div className="grid items-start gap-2" style={grid}>
                    <span className="pt-2.5 text-center font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </span>

                    <Textarea
                      rows={2}
                      className="min-h-11"
                      style={{ fontFamily: 'var(--ssz-font-reading)' }}
                      aria-label={t('multipleChoiceGroup.step2.statementAria', {
                        index: index + 1,
                      })}
                      aria-invalid={missingAnswer}
                      value={row.text}
                      placeholder={t('multipleChoiceGroup.step2.statementPlaceholder')}
                      onChange={(event) =>
                        onChange(setRow(exercise, row.id, { text: event.target.value }))
                      }
                    />

                    {/*
                      One radio group per row rather than per cell: a lone radio outside a
                      group is not a control a screen reader can describe, and it is the
                      group that says "one of these" — which is the entire rule the model
                      enforces in `setAnswer`.
                    */}
                    {columns.map((column) => (
                      <span
                        key={column.id}
                        className="flex justify-center pt-1.5"
                        role="radiogroup"
                        aria-label={t('multipleChoiceGroup.step2.statementAria', {
                          index: index + 1,
                        })}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={row.answer === column.id}
                          aria-label={t('multipleChoiceGroup.step2.markAria', {
                            index: index + 1,
                            label:
                              column.label.trim() === ''
                                ? t('multipleChoiceGroup.step2.unnamedColumn')
                                : column.label,
                          })}
                          onClick={() => onChange(markAnswer(exercise, row.id, column.id))}
                          className={`grid size-7 shrink-0 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                            row.answer === column.id
                              ? 'border-success-500 bg-success-500 text-white'
                              : 'border-border text-transparent hover:border-success-500'
                          }`}
                        >
                          <Check className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    ))}

                    <span className="flex justify-center pt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={exercise.rows.length <= MIN_ROWS}
                        title={
                          exercise.rows.length <= MIN_ROWS
                            ? t('multipleChoiceGroup.step2.removeFloor')
                            : undefined
                        }
                        aria-label={t('multipleChoiceGroup.step2.remove', { index: index + 1 })}
                        onClick={() => onChange(removeRow(exercise, row.id))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </span>
                  </div>

                  {/* Timecodes per row are the high-value case for this type: a table of
                      statements about one dialogue, each with its own line to hear
                      (INTEGRATION.md). Under the row rather than beside it — the grid is
                      the table's, and a fifth column would break the header. */}
                  {timecodes && (
                    <div className="pt-1.5 pl-[38px]">
                      <AudioSegmentField
                        segment={exercise.audio.segments[row.id] ?? null}
                        onChange={(segment) =>
                          onChange({
                            ...exercise,
                            audio: withSegment(exercise.audio, row.id, segment),
                          })
                        }
                      />
                    </div>
                  )}

                  {(missingAnswer || notes.length > 0) && (
                    <div className="flex flex-col gap-1 pt-1.5 pl-[38px]">
                      {missingAnswer && (
                        <p className="flex items-start gap-1.5 text-xs text-error">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          {t('multipleChoiceGroup.issues.ROW_NO_ANSWER')}
                        </p>
                      )}
                      {notes.map((flag, at) => (
                        <p
                          key={`${flag.code}-${at}`}
                          className={`flex items-start gap-1.5 text-xs ${
                            flag.level === 'warning' ? 'text-warning-700' : 'text-muted-foreground'
                          }`}
                        >
                          {flag.level === 'warning' ? (
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          ) : (
                            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          )}
                          {describeIssue(flag, { bare: true })}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => onChange(addRow(exercise))}>
          <Plus className="size-4" aria-hidden />
          {t('multipleChoiceGroup.step2.addStatement')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('multipleChoiceGroup.step2.rowsCount', { count: exercise.rows.length })} ·{' '}
          {t('multipleChoiceGroup.step2.readyHelp')}
        </span>
      </div>

      {/* Group-scoped findings — the lopsided key, an unused column, a table that is too
          short or too long. They belong to no row, so they sit under the table rather than
          being attached to whichever row happens to be last. */}
      {groupFlags.map((flag, at) => (
        <p
          key={`${flag.code}-${at}`}
          className={`flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs ${
            flag.level === 'warning'
              ? 'border-warning-500/40 text-warning-700'
              : 'border-border text-muted-foreground'
          }`}
        >
          {flag.level === 'warning' ? (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          )}
          {describeIssue(flag)}
        </p>
      ))}

      <BulkPasteDialog
        open={bulkOpen}
        exercise={exercise}
        onOpenChange={setBulkOpen}
        onApply={(text) => onChange(applyBulkPaste(exercise, text))}
      />
    </div>
  );
}

/**
 * A worksheet becomes a table in one paste — `Statement | R`.
 *
 * The parse runs live so the count under the box is the count that will be added, and the
 * marker resolution is the kernel's: short code, full label, or 1-based column number. A
 * line with no marker arrives unanswered rather than guessed at, which is what makes the
 * "N with an answer" line worth reading.
 */
function BulkPasteDialog({
  open,
  exercise,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  exercise: MultipleChoiceGroupDocument;
  onOpenChange: (open: boolean) => void;
  onApply: (text: string) => void;
}) {
  const t = useTranslations('Authoring');
  const [text, setText] = useState('');

  const parsed = parseBulk(exercise.columns, text);
  const marked = parsed.filter((row) => row.answer !== null).length;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setText('');
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('multipleChoiceGroup.step2.bulkTitle')}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{t('multipleChoiceGroup.step2.bulkHelp')}</p>
        <Textarea
          rows={8}
          className="font-mono text-[13px]"
          aria-label={t('multipleChoiceGroup.step2.bulkTitle')}
          value={text}
          placeholder={t('multipleChoiceGroup.step2.bulkPlaceholder')}
          onChange={(event) => setText(event.target.value)}
        />
        {parsed.length > 0 && (
          <p
            className={`text-xs ${marked === parsed.length ? 'text-success-700' : 'text-warning-700'}`}
          >
            {t('multipleChoiceGroup.step2.bulkParsed', { count: parsed.length, marked })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t('multipleChoiceGroup.step2.bulkNote')}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {t('multipleChoiceGroup.step2.bulkCancel')}
          </Button>
          <Button
            type="button"
            disabled={parsed.length === 0}
            onClick={() => {
              onApply(text);
              close(false);
            }}
          >
            {t('multipleChoiceGroup.step2.bulkApply', { count: parsed.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
