'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Info, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { matchesPreset, PRESETS, type SourceMode } from '@/lib/shared-kernel/multiple-choice-group';

import {
  addColumn,
  applyPreset,
  MAX_COLUMNS,
  MIN_COLUMNS,
  removeColumn,
  setColumn,
  setSettings,
  setSource,
  type MultipleChoiceGroupDocument,
} from './edits';

export interface StepSetupProps {
  exercise: MultipleChoiceGroupDocument;
  onChange: (next: MultipleChoiceGroupDocument) => void;
}

/**
 * Step 1: the text the statements are about, and the columns they are answered with.
 *
 * The columns come before the statements because they are shared by every row — that is
 * the whole type. An author who writes ten statements against Riktig/Galt and then decides
 * the text needs «Står ikke i teksten» has to revisit ten answers; one who chooses the
 * columns first does not. The handoff orders the steps that way for this reason, and the
 * preset cards are what make the choice a click rather than three fields.
 *
 * Nothing here writes `source.lessonId`, and that is plan 54's answer to Q5: «Til teksten»
 * points at the lesson the exercise sits under, which is known from its place in the
 * course, so there is no lesson to pick and no picker to build. `link` mode carries a
 * label and nothing else.
 */
export function StepSetup({ exercise, onChange }: StepSetupProps) {
  const t = useTranslations('Authoring');

  const source = exercise.source;
  const noInstruction = exercise.instruction.trim() === '';
  const noText = source.text.trim() === '';
  const words = source.text.trim() === '' ? 0 : source.text.trim().split(/\s+/u).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoiceGroup.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoiceGroup.step1.lede')}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="mcg-title">
            {t('multipleChoiceGroup.step1.titleLabel')}
          </label>
          <Input
            id="mcg-title"
            aria-describedby="mcg-title-help"
            value={exercise.title}
            placeholder={t('multipleChoiceGroup.step1.titlePlaceholder')}
            onChange={(event) => onChange({ ...exercise, title: event.target.value })}
          />
          <p id="mcg-title-help" className="text-xs text-muted-foreground">
            {t('multipleChoiceGroup.step1.titleHelp')}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="mcg-instruction">
            {t('multipleChoiceGroup.step1.instructionLabel')}
          </label>
          <Input
            id="mcg-instruction"
            aria-describedby="mcg-instruction-help"
            value={exercise.instruction}
            placeholder={t('multipleChoiceGroup.step1.instructionPlaceholder')}
            onChange={(event) => onChange({ ...exercise, instruction: event.target.value })}
          />
          {/* A warning rather than a blocker, as the handoff grades it (S1.2): a table with
              no line above it is worse, not unusable. */}
          <p
            id="mcg-instruction-help"
            className={`text-xs ${noInstruction ? 'text-warning-700' : 'text-muted-foreground'}`}
          >
            {noInstruction
              ? t('multipleChoiceGroup.issues.EX_NO_INSTRUCTION')
              : t('multipleChoiceGroup.step1.instructionHelp')}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('multipleChoiceGroup.step1.materialTitle')}</h3>
          <Segmented<SourceMode>
            value={source.mode}
            aria-label={t('multipleChoiceGroup.step1.modeLabel')}
            onValueChange={(mode) => onChange(setSource(exercise, { mode }))}
            options={[
              { value: 'none', label: t('multipleChoiceGroup.step1.modeNone') },
              { value: 'inline', label: t('multipleChoiceGroup.step1.modeInline') },
              { value: 'link', label: t('multipleChoiceGroup.step1.modeLink') },
            ]}
          />
        </div>

        {source.mode === 'none' && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('multipleChoiceGroup.step1.noneHelp')}
          </p>
        )}

        {source.mode !== 'none' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="mcg-source-label">
              {source.mode === 'link'
                ? t('multipleChoiceGroup.step1.lessonLabel')
                : t('multipleChoiceGroup.step1.headingLabel')}
            </label>
            <Input
              id="mcg-source-label"
              value={source.label}
              placeholder={t('multipleChoiceGroup.step1.headingPlaceholder')}
              onChange={(event) => onChange(setSource(exercise, { label: event.target.value }))}
            />
            {source.mode === 'link' && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t('multipleChoiceGroup.step1.linkHelp')}
              </p>
            )}
          </div>
        )}

        {source.mode === 'inline' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="mcg-source-text">
              {t('multipleChoiceGroup.step1.textLabel')}
            </label>
            <Textarea
              id="mcg-source-text"
              aria-describedby="mcg-source-text-help"
              rows={8}
              value={source.text}
              hasError={noText}
              aria-invalid={noText}
              style={{ fontFamily: 'var(--ssz-font-reading)' }}
              placeholder={t('multipleChoiceGroup.step1.textPlaceholder')}
              onChange={(event) => onChange(setSource(exercise, { text: event.target.value }))}
            />
            {/* The word count is the live half of this field: a passage a teacher pasted
                out of a lesson is either the paragraph they meant or the whole page, and
                the count is the only thing on screen that tells them apart. */}
            <p
              id="mcg-source-text-help"
              className={`text-xs ${noText ? 'text-error' : 'text-muted-foreground'}`}
            >
              {noText
                ? t('multipleChoiceGroup.issues.SOURCE_EMPTY')
                : `${t('multipleChoiceGroup.step1.textHelp')} · ${t('multipleChoiceGroup.step1.textWords', { count: words })}`}
            </p>
          </div>
        )}

        {/* `showText` lives on step 3 with the rest of the settings, but an author who has
            just pasted a passage and turned it off two steps ago would be looking at a
            field with no effect. Said here rather than moved. */}
        {source.mode === 'inline' && !exercise.settings.showText && (
          <p className="flex items-start gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('multipleChoiceGroup.step3.showTextHelp')}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onChange(setSettings(exercise, { showText: true }))}
            >
              {t('multipleChoiceGroup.step3.showTextLabel')}
            </Button>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('multipleChoiceGroup.step1.columnsTitle')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('multipleChoiceGroup.step1.columnsCount', { count: exercise.columns.length })}
          </p>
        </div>

        {/*
          The presets are pressed by comparing labels in order (S1.7) rather than by a
          stored id: an author who renamed «Galt» has left the preset, and a card that
          stayed pressed would be claiming otherwise.
        */}
        <ul className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map((preset) => {
            const active = matchesPreset(exercise, preset);
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(applyPreset(exercise, preset))}
                  className={`flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    active
                      ? 'border-primary bg-[var(--ssz-bg-subtle)]'
                      : 'border-border hover:bg-[var(--ssz-bg-subtle)]'
                  }`}
                >
                  <span className="text-sm font-medium">
                    {t(
                      `multipleChoiceGroup.step1.preset${capitalize(preset.id)}` as 'multipleChoiceGroup.step1.presetRg',
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(
                      `multipleChoiceGroup.step1.preset${capitalize(preset.id)}Desc` as 'multipleChoiceGroup.step1.presetRgDesc',
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{t('multipleChoiceGroup.step1.presetNote')}</p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="flex-1">{t('multipleChoiceGroup.step1.columnHeader')}</span>
            <span className="w-20">{t('multipleChoiceGroup.step1.shortHeader')}</span>
            <span className="w-9" />
          </div>

          {exercise.columns.map((column, index) => {
            const unnamed = column.label.trim() === '';
            return (
              <div key={column.id} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  aria-label={t('multipleChoiceGroup.step1.columnAria', { index: index + 1 })}
                  value={column.label}
                  hasError={unnamed}
                  aria-invalid={unnamed}
                  onChange={(event) =>
                    onChange(setColumn(exercise, column.id, { label: event.target.value }))
                  }
                />
                <Input
                  className="w-20 text-center font-mono"
                  maxLength={3}
                  aria-label={t('multipleChoiceGroup.step1.shortAria', { index: index + 1 })}
                  value={column.short}
                  onChange={(event) =>
                    onChange(setColumn(exercise, column.id, { short: event.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={exercise.columns.length <= MIN_COLUMNS}
                  title={
                    exercise.columns.length <= MIN_COLUMNS
                      ? t('multipleChoiceGroup.step1.removeColumnFloor')
                      : undefined
                  }
                  aria-label={t('multipleChoiceGroup.step1.removeColumn', { index: index + 1 })}
                  onClick={() => onChange(removeColumn(exercise, column.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={exercise.columns.length >= MAX_COLUMNS}
              title={
                exercise.columns.length >= MAX_COLUMNS
                  ? t('multipleChoiceGroup.step1.addColumnCeiling')
                  : undefined
              }
              onClick={() => onChange(addColumn(exercise))}
            >
              <Plus className="size-4" aria-hidden />
              {t('multipleChoiceGroup.step1.addColumn')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('multipleChoiceGroup.step1.shortHelp')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function capitalize(id: string): string {
  return id.slice(0, 1).toUpperCase() + id.slice(1);
}
