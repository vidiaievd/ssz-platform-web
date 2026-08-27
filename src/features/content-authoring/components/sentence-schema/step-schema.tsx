'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';

import { useContainerWidth } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  CLAUSE_IDS,
  PRESETS,
  issues,
  preset,
  type ClauseId,
} from '@/lib/shared-kernel/sentence-schema';
import { fitsAsColumns, SchemaBoard } from '@/features/student/exercises/runner/schema-board';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

import { useIssueCopy } from './issue-copy';
import {
  addField,
  applyPreset,
  hasPlacements,
  moveField,
  removeField,
  setField,
  toggleClause,
  type SentenceSchemaDocument,
} from './edits';

export interface StepSchemaProps {
  exercise: SentenceSchemaDocument;
  onChange: (next: SentenceSchemaDocument) => void;
}

/**
 * Step 1: the fields, what they are called, and which clause types use them.
 *
 * The screen where this type earns the claim that it is language-agnostic. The field set
 * is data — a pack is a seed, everything after it is the author's, and nothing in the
 * runtime knows what "Forfelt" means. `presetId` records where the schema came from and
 * has no other power; the schema in the document is the authority (README, "provenance
 * only; schema is authoritative").
 *
 * Two edits here reach into every sentence in the document, and they are the only
 * irreversible things in this builder: switching the pack rebuilds the field ids, so every
 * placement in the set is cleared. That is why the warning sits above the grid whenever
 * there is work to lose rather than appearing in a dialogue after the click.
 *
 * Deleting a field is the quiet one. It asks nothing, and it makes every sentence that
 * used the field undeliverable — the card's `N words left` and the step-2 dot going back
 * to amber are the whole of the report. That is on purpose: it is also the check that the
 * validation engine is single, because a dot that stayed green would prove otherwise.
 */
export function StepSchema({ exercise, onChange }: StepSchemaProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);
  const [editing, setEditing] = useState<ClauseId>(exercise.clauses[0] ?? 'main');
  const [board, boardWidth] = useContainerWidth();

  const problems = issues(exercise).filter((issue) => issue.step === 1);
  const destructive = hasPlacements(exercise);
  const clause = exercise.clauses.includes(editing) ? editing : (exercise.clauses[0] ?? editing);
  const fields = exercise.schema[clause] ?? [];

  const clauseName = (id: ClauseId) =>
    t(`sentenceSchema.clause.${id}` as 'sentenceSchema.clause.main');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('sentenceSchema.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('sentenceSchema.step1.lede')}</p>
      </div>

      {/* Kept editable rather than hidden: the schema is what the exercise goes back to
          when the mode is switched off, and an author needs to see what that is. */}
      {exercise.settings.orderOnly && (
        <p className="flex items-start gap-1.5 rounded-lg border border-border bg-subtle p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('sentenceSchema.step1.orderOnlyNotice')}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">{t('sentenceSchema.step1.packsLabel')}</p>
          <p className="text-xs text-muted-foreground">{t('sentenceSchema.step1.packsHelp')}</p>
        </div>

        {destructive && (
          <p className="flex items-start gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('sentenceSchema.step1.packWarning')}
          </p>
        )}

        <div
          role="radiogroup"
          aria-label={t('sentenceSchema.step1.packsLabel')}
          className="grid gap-2 sm:grid-cols-2"
        >
          {PRESETS.map((pack) => {
            const chosen = exercise.presetId === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => onChange(applyPreset(exercise, pack.id))}
                className={`flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left ${
                  chosen
                    ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) dark:bg-(--ssz-color-primary-950)'
                    : 'border-border bg-surface hover:bg-subtle'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {pack.lang}
                </span>
                <span className="text-sm font-semibold">{pack.name}</span>
                <span className="text-xs text-muted-foreground">{pack.desc}</span>
                <span className="font-mono text-xs text-(--ssz-color-primary-700)">
                  {preset(pack.id)
                    .build()
                    .main.map((field) => field.short)
                    .join(' · ')}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">{t('sentenceSchema.step1.clausesTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('sentenceSchema.step1.clausesLede')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CLAUSE_IDS.map((id) => {
            const on = exercise.clauses.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onChange(toggleClause(exercise, id));
                  // BEHAVIOR: "when a clause type is switched on, the field editor jumps
                  // to it" — the author turned it on in order to give it fields.
                  if (!on) setEditing(id);
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                  on
                    ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) dark:bg-(--ssz-color-primary-950)'
                    : 'border-border bg-surface hover:bg-subtle'
                }`}
              >
                {on ? (
                  <Check className="size-3.5 shrink-0 text-(--ssz-color-primary-700)" aria-hidden />
                ) : (
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>
                  <span className="block text-sm">{clauseName(id)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {t(`sentenceSchema.clauseSub.${id}` as 'sentenceSchema.clauseSub.main')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {problems.map((issue, position) => (
        <p
          key={`${issue.code}-${position}`}
          role={issue.level === 'blocker' ? 'alert' : undefined}
          className={`flex items-start gap-1.5 text-xs ${
            issue.level === 'blocker' ? 'text-error' : 'text-warning-700'
          }`}
        >
          {issue.level === 'blocker' ? (
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          )}
          {describeIssue(issue)}
        </p>
      ))}

      {exercise.clauses.length > 0 && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{t('sentenceSchema.step1.fieldsTitle')}</p>
            {exercise.clauses.length > 1 && (
              <Segmented<ClauseId>
                aria-label={t('sentenceSchema.step1.fieldsForLabel')}
                value={clause}
                onValueChange={setEditing}
                options={exercise.clauses.map((id) => ({ value: id, label: clauseName(id) }))}
              />
            )}
          </div>

          {/*
            The same board the student plays on, read-only — so "what the fields are
            called" is answered by the thing the answer is about, not by a list that
            resembles it.
          */}
          <div ref={board}>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {t('sentenceSchema.step1.boardPreviewLabel')}
            </p>
            <SchemaBoard
              fields={fields}
              placement={{}}
              textOf={() => ''}
              layout={fitsAsColumns(boardWidth, fields.length) ? 'cols' : 'rows'}
              labels
              hints
              counts={null}
              marks={null}
              selectedField={null}
              readOnly
              accent={PRACTICE_ACCENT}
            />
          </div>

          {fields.length === 0 ? (
            <p className="text-xs text-error" role="alert">
              {t('sentenceSchema.step1.noFields')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <li key={field.id} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="w-16 text-center font-mono"
                    value={field.short}
                    aria-label={t('sentenceSchema.step1.shortLabel')}
                    onChange={(event) =>
                      onChange(setField(exercise, clause, field.id, { short: event.target.value }))
                    }
                  />
                  <Input
                    className="w-40"
                    value={field.label}
                    aria-label={t('sentenceSchema.step1.nameLabel')}
                    onChange={(event) =>
                      onChange(setField(exercise, clause, field.id, { label: event.target.value }))
                    }
                  />
                  <Input
                    className="min-w-48 flex-1"
                    value={field.hint}
                    placeholder={t('sentenceSchema.step1.hintPlaceholder')}
                    aria-label={t('sentenceSchema.step1.hintLabel')}
                    onChange={(event) =>
                      onChange(setField(exercise, clause, field.id, { hint: event.target.value }))
                    }
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={field.optional}
                      onCheckedChange={(checked) =>
                        onChange(
                          setField(exercise, clause, field.id, { optional: checked === true }),
                        )
                      }
                    />
                    {t('sentenceSchema.step1.optionalLabel')}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    aria-label={t('sentenceSchema.step1.moveLeft')}
                    onClick={() => onChange(moveField(exercise, clause, field.id, -1))}
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === fields.length - 1}
                    aria-label={t('sentenceSchema.step1.moveRight')}
                    onClick={() => onChange(moveField(exercise, clause, field.id, 1))}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('sentenceSchema.step1.removeField')}
                    title={t('sentenceSchema.step1.removeFieldHelp')}
                    onClick={() => onChange(removeField(exercise, clause, field.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onChange(addField(exercise, clause, t('sentenceSchema.step1.newFieldName')))
              }
            >
              <Plus className="size-4" aria-hidden />
              {t('sentenceSchema.step1.addField')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
