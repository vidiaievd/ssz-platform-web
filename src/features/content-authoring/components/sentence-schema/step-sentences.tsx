'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardPaste,
  Columns3,
  ListOrdered,
  Plus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { deliverableRows, issues, type Issue, type Row } from '@/lib/shared-kernel/sentence-schema';

import { ReorderWithAnnouncer } from '../lesson-reorder';
import { SentenceCard } from './sentence-card';
import { useIssueCopy } from './issue-copy';
import {
  addRow,
  applyBulkPaste,
  removeRow,
  reorderRows,
  type SentenceSchemaDocument,
} from './edits';

export interface StepSentencesProps {
  exercise: SentenceSchemaDocument;
  onChange: (next: SentenceSchemaDocument) => void;
  /** Where the mode is switched. Absent in a test or a preview that has no rail. */
  onGoToStep?: (step: number) => void;
}

/**
 * Step 2: the sentences, and where every word of each belongs.
 *
 * The heart of the builder, and the reason the handoff's build order puts it before the
 * three mechanical steps: what is written here is the answer key, the word bank and the
 * student's sentence all at once, so everything the other steps do is a decision *about*
 * this screen rather than a thing of its own.
 *
 * Problems are shown here, on the cards they belong to, and not only in the gate — the
 * rule plan 50 set and every builder since has followed. Each one names its sentence, so
 * a reorder cannot make it point somewhere else.
 */
export function StepSentences({ exercise, onChange, onGoToStep }: StepSentencesProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');

  const problems = issues(exercise).filter((issue) => issue.step === 2);
  /** The ones about the set rather than about a sentence — nothing to pin them to. */
  const setWide = problems.filter((issue) => !('rowId' in issue));
  const ready = deliverableRows(exercise);
  const defaultClause = exercise.clauses[0] ?? 'main';
  const pastedCount = bulk.split('\n').filter((line) => line.trim() !== '').length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('sentenceSchema.step2.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('sentenceSchema.step2.lede')}</p>
      </div>

      {/*
        Which of the two exercises this is, said on the step the builder opens on.

        It was on step 3 and nowhere else, which made the mode invisible: an author looking
        at a set of sentence cards had no way to learn that a second mode existed, let
        alone that this document was in one. A setting whose effect is this large is not
        only a setting — it is a fact about the document, and it belongs where the document
        is being written.
      */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-subtle px-3 py-2">
        {exercise.settings.orderOnly ? (
          <ListOrdered className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <Columns3 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="text-xs">
          {exercise.settings.orderOnly
            ? t('sentenceSchema.step2.modeOrder')
            : t('sentenceSchema.step2.modeSchema')}
        </span>
        {onGoToStep !== undefined && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => onGoToStep(3)}
          >
            {t('sentenceSchema.step2.modeChange')}
          </Button>
        )}
      </div>

      {exercise.settings.orderOnly && (
        <p className="text-xs text-muted-foreground">{t('sentenceSchema.step2.orderOnlyNotice')}</p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t('sentenceSchema.step2.titleLabel')}</span>
          <Input
            value={exercise.title}
            placeholder={t('sentenceSchema.step2.titlePlaceholder')}
            onChange={(event) => onChange({ ...exercise, title: event.target.value })}
          />
        </label>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="ss-instruction">
            {t('sentenceSchema.step2.instructionLabel')}
          </label>
          <Input
            id="ss-instruction"
            aria-describedby="ss-instruction-help"
            value={exercise.instruction}
            placeholder={t('sentenceSchema.step2.instructionPlaceholder')}
            onChange={(event) => onChange({ ...exercise, instruction: event.target.value })}
          />
          <p id="ss-instruction-help" className="text-xs text-muted-foreground">
            {t('sentenceSchema.step2.instructionHelp')}
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t('sentenceSchema.step2.ready', { count: ready.length })}
        </p>
        {exercise.rows.length > 1 && (
          <p className="text-xs text-muted-foreground">{t('sentenceSchema.step2.reorderHelp')}</p>
        )}
      </div>

      {setWide.map((issue, position) => (
        <IssueLine key={`${issue.code}-${position}`} issue={issue} text={describeIssue(issue)} />
      ))}

      {exercise.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium">{t('sentenceSchema.step2.emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {t('sentenceSchema.step2.emptyBody')}
          </p>
        </div>
      ) : (
        <ReorderWithAnnouncer
          items={exercise.rows.map((row) => ({ ...row, title: row.text }))}
          onReorder={(reordered) =>
            onChange(
              reorderRows(
                exercise,
                reordered.map(({ title: _title, ...row }) => row as Row),
              ),
            )
          }
        >
          {(row, position) => (
            <div className="flex flex-col gap-1.5 pb-3">
              <SentenceCard
                exercise={exercise}
                row={row}
                index={position - 1}
                onChange={onChange}
                onRemove={() => onChange(removeRow(exercise, row.id))}
                canDelete={exercise.rows.length > 1}
              />
              {problems
                .filter((issue) => 'rowId' in issue && issue.rowId === row.id)
                .map((issue, at) => (
                  <IssueLine
                    key={`${issue.code}-${at}`}
                    issue={issue}
                    text={describeIssue(issue)}
                  />
                ))}
            </div>
          )}
        </ReorderWithAnnouncer>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(addRow(exercise, defaultClause))}
        >
          <Plus className="size-4" aria-hidden />
          {t('sentenceSchema.step2.addSentence')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setBulkOpen(!bulkOpen)}>
          <ClipboardPaste className="size-4" aria-hidden />
          {t('sentenceSchema.step2.bulkOpen')}
        </Button>
      </div>

      {/*
        A page of a workbook becomes a set in one paste — the only place in the builder
        where placements are made without touching a board. Segments map to fields
        positionally and stop at the last one: the kernel never invents a field to hold a
        segment, because a paste that appeared to work against someone else's schema is
        the worst outcome available here.
      */}
      {bulkOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium">{t('sentenceSchema.step2.bulkTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('sentenceSchema.step2.bulkHelp')}</p>
          <Textarea
            rows={5}
            value={bulk}
            aria-label={t('sentenceSchema.step2.bulkTitle')}
            placeholder={t('sentenceSchema.step2.bulkPlaceholder')}
            onChange={(event) => setBulk(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('sentenceSchema.step2.bulkNote')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={bulk.trim() === ''}
              onClick={() => {
                onChange(applyBulkPaste(exercise, bulk, defaultClause));
                setBulk('');
                setBulkOpen(false);
              }}
            >
              {t('sentenceSchema.step2.bulkApply', { count: pastedCount })}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)}>
              {t('sentenceSchema.step2.bulkCancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One problem, in the tone its level earns. Blockers speak up; warnings sit quietly. */
function IssueLine({ issue, text }: { issue: Issue; text: string }) {
  const blocker = issue.level === 'blocker';

  return (
    <p
      role={blocker ? 'alert' : undefined}
      className={`flex items-start gap-1.5 text-xs ${blocker ? 'text-error' : 'text-warning-700'}`}
    >
      {blocker ? (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      {text}
    </p>
  );
}
