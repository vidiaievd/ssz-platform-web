'use client';

import { useState } from 'react';
import { ArrowRight, Grid3x3, Link2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  canAddRow,
  cellOf,
  formsCoverage,
  isLinked,
  issues,
  paradigmOf,
  slotsInPlay,
  type InflectionTableContent,
  type Row,
} from '@/lib/shared-kernel/inflection-table';

import { Notes, type Note } from '../dictation/notes';
import { Bar, Callout, EmptyState, StepHead } from '../highlight-in-text/parts';
import { DictionaryPicker } from './dictionary-picker';
import {
  addFromDictionary,
  addManualRow,
  bulkFirstGiven,
  bulkOpenAll,
  removeRow,
  setCellMode,
  setCellValue,
  setLemma,
} from './edits';
import { useIssueCopy } from './issue-copy';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
const MONO = 'font-mono text-[10px] text-(--ssz-text-muted)';
const CELL_BORDER = 'border-b border-r border-(--ssz-border-default) last:border-r-0';

export interface StepFormsProps<T extends InflectionTableContent> {
  exerciseId: string;
  exercise: T;
  onChange: (next: T) => void;
  onGoToStep: (step: number) => void;
}

/**
 * Step 2: lemmas and forms (plan 69 §7.3) — one table, not four gaps.
 *
 * Rows come from the course dictionary with their forms as suggestions, or are typed by hand;
 * each cell is *given* or *asked* by clicking its marker, and an asked cell with no key is red
 * (the server cannot grade it). Ten rows is the ceiling on every path (IT-B6). What the issue
 * list says about a row is drawn under its lemma, and what it says about the table above the
 * grid — the same findings the rail and the gate read (IT-B1).
 */
export function StepForms<T extends InflectionTableContent>({
  exerciseId,
  exercise,
  onChange,
  onGoToStep,
}: StepFormsProps<T>) {
  const t = useTranslations('Authoring.inflectionTable.step2');
  const copy = useIssueCopy(exercise);
  const [picking, setPicking] = useState(false);

  const paradigm = paradigmOf(exercise);
  const slots = slotsInPlay(exercise);
  const cov = formsCoverage(exercise);
  const found = issues(exercise).filter((issue) => issue.step === 2);

  const tableNotes: Note[] = found
    .filter((issue) => !('rowId' in issue))
    .map((issue) => ({
      key: issue.code + ('slotId' in issue ? issue.slotId : ''),
      level: issue.level,
      text: copy.describe(issue),
    }));

  /** What the list says about this row, bare — the lemma column already names the row. */
  const rowNotes = (row: Row): Note[] =>
    found
      .filter((issue) => 'rowId' in issue && issue.rowId === row.id && !('slotId' in issue))
      // «Not linked» is already the line under the lemma — an info that says it twice is noise.
      .filter((issue) => issue.level !== 'info')
      .map((issue) => ({
        key: issue.code,
        level: issue.level,
        text: copy.describe(issue, { bare: true }),
      }));

  return (
    <div className="flex flex-col gap-5">
      <StepHead
        eyebrow={t('eyebrow')}
        title={t('title')}
        lede={t.rich('lede', { b: (chunks) => <b className="font-semibold">{chunks}</b> })}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setPicking(true)}>
          <Plus className="size-4" aria-hidden />
          {t('fromDictionary')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canAddRow(exercise)}
          onClick={() => onChange(addManualRow(exercise))}
        >
          <Pencil className="size-4" aria-hidden />
          {t('typeLemma')}
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(bulkFirstGiven(exercise))}
        >
          {t('firstGiven')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(bulkOpenAll(exercise))}
        >
          {t('openAll')}
        </Button>
      </div>

      <Notes notes={tableNotes} />

      {exercise.rows.length === 0 ? (
        <EmptyState
          icon={Grid3x3}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Button type="button" onClick={() => setPicking(true)}>
              <Plus className="size-4" aria-hidden />
              {t('fromDictionary')}
            </Button>
          }
        />
      ) : (
        <div
          className="overflow-x-auto rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface)"
          style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
        >
          <table className="w-full border-separate border-spacing-0" aria-label={t('gridLabel')}>
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`${CELL_BORDER} min-w-[170px] whitespace-nowrap bg-(--ssz-bg-subtle) px-2.5 py-2 text-left align-bottom text-xs font-semibold text-(--ssz-text-secondary)`}
                >
                  {paradigm?.lemmaLabel}
                </th>
                {slots.map((slot) => (
                  <th
                    key={slot.id}
                    scope="col"
                    className={`${CELL_BORDER} whitespace-nowrap bg-(--ssz-bg-subtle) px-2.5 py-2 text-left align-bottom`}
                  >
                    <b className="block text-xs font-semibold text-(--ssz-text-secondary)">
                      {slot.label}
                    </b>
                    <span className={MONO}>{slot.atom}</span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="w-[38px] border-b border-(--ssz-border-default) bg-(--ssz-bg-subtle)"
                >
                  <span className="sr-only">{t('actionsColumn')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {exercise.rows.map((row, rowIndex) => {
                const notes = rowNotes(row);
                return (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className={`${CELL_BORDER} min-w-[170px] px-2.5 py-1.5 text-left align-top`}
                    >
                      <input
                        aria-label={t('lemmaLabel', { index: rowIndex + 1 })}
                        value={row.lemma}
                        placeholder={paradigm?.lemmaHint}
                        lang={exercise.language}
                        onChange={(e) => onChange(setLemma(exercise, row.id, e.target.value))}
                        className="w-full border-0 border-b border-transparent bg-transparent py-1 text-base font-medium outline-none focus:border-(--ssz-color-primary-500)"
                        style={READING}
                      />
                      <span className="flex items-center gap-1 text-[11px] font-normal text-(--ssz-text-muted)">
                        {isLinked(row) ? (
                          <>
                            <Link2 size={11} aria-hidden="true" />
                            <span title={t('linked')}>
                              {row.gloss === '' ? t('linked') : row.gloss}
                            </span>
                          </>
                        ) : (
                          <>
                            <Pencil size={11} aria-hidden="true" />
                            {t('notLinked')}
                          </>
                        )}
                      </span>
                      <Notes notes={notes} />
                    </th>
                    {slots.map((slot) => {
                      const cell = cellOf(row, slot.id);
                      const asked = cell.mode === 'ask';
                      const bad = asked && cell.value.trim() === '';
                      const mark = asked ? t('asked') : t('given');
                      return (
                        <td
                          key={slot.id}
                          data-mode={cell.mode}
                          data-bad={bad ? 'true' : undefined}
                          className={`${CELL_BORDER} relative p-0 ${
                            bad
                              ? 'bg-(--ssz-color-error-50) shadow-[inset_0_0_0_1px_var(--ssz-color-error-300)]'
                              : asked
                                ? 'bg-(--ssz-color-primary-50)'
                                : 'bg-(--ssz-bg-subtle)'
                          }`}
                        >
                          <button
                            type="button"
                            aria-pressed={asked}
                            aria-label={`${mark} — ${t('cellLabel', { lemma: row.lemma, slot: slot.label })}`}
                            title={mark}
                            onClick={() =>
                              onChange(
                                setCellMode(exercise, row.id, slot.id, asked ? 'prefill' : 'ask'),
                              )
                            }
                            className={`absolute top-2.5 left-[5px] grid size-[18px] place-items-center rounded-[4px] hover:bg-black/10 focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
                              asked ? 'text-(--ssz-color-primary-600)' : 'text-(--ssz-text-muted)'
                            }`}
                          >
                            {asked ? (
                              <Pencil size={12} aria-hidden="true" />
                            ) : (
                              <Lock size={12} aria-hidden="true" />
                            )}
                          </button>
                          <input
                            aria-label={t('cellLabel', { lemma: row.lemma, slot: slot.label })}
                            aria-invalid={bad ? true : undefined}
                            value={cell.value}
                            placeholder={asked ? t('keyPlaceholder') : t('givenPlaceholder')}
                            lang={exercise.language}
                            onChange={(e) =>
                              onChange(setCellValue(exercise, row.id, slot.id, e.target.value))
                            }
                            className={`w-full border-0 bg-transparent py-[11px] pr-2.5 pl-7 text-base outline-none focus:shadow-[inset_0_0_0_2px_var(--ssz-color-primary-500)] ${
                              asked ? '' : 'text-(--ssz-text-secondary)'
                            }`}
                            style={READING}
                          />
                          {asked && cell.why.trim() !== '' && (
                            <i
                              title={t('hasReason')}
                              role="img"
                              aria-label={t('hasReason')}
                              className="absolute top-3 right-1.5 size-1.5 rounded-full bg-(--ssz-color-success-500)"
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="w-[38px] border-b border-(--ssz-border-default) text-center align-middle">
                      <button
                        type="button"
                        aria-label={t('removeRow')}
                        title={t('removeRow')}
                        onClick={() => onChange(removeRow(exercise, row.id))}
                        className="inline-grid size-7 place-items-center rounded-(--ssz-radius-sm) text-(--ssz-text-muted) hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700) focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {exercise.rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-4 py-3">
          <div>
            <div className="text-xl font-bold">
              {t('coverageAsked', { asked: cov.asked, total: cov.total })}
            </div>
            <p className="m-0 mt-0.5 text-xs text-(--ssz-text-muted)">
              {t('coverageDetail', { filled: cov.filled, asked: cov.asked, why: cov.withWhy })}
            </p>
          </div>
          <div className="min-w-[120px] flex-1">
            <Bar
              value={cov.total === 0 ? 0 : (cov.asked / cov.total) * 100}
              label={t('coverageAsked', { asked: cov.asked, total: cov.total })}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onGoToStep(3)}>
            {t('reasons')}
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}

      <Callout tone="info">
        {t.rich('info', {
          code: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
        })}
      </Callout>

      <DictionaryPicker
        exerciseId={exerciseId}
        exercise={exercise}
        open={picking}
        onOpenChange={setPicking}
        onAdd={(entry) => onChange(addFromDictionary(exercise, entry))}
      />
    </div>
  );
}
