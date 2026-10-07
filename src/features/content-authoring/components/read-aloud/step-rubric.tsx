'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Eye, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  RA_MAX_CRITERIA,
  RA_MIN_CRITERIA,
  rubricMax,
  SHOW_MODEL,
  SHOW_RUBRIC,
  type Criterion,
  type CriterionWeight,
} from '@/lib/shared-kernel/read-aloud';

import { Bar, Card, Field, StepHead } from '../highlight-in-text/parts';
import {
  addCriterion,
  removeCriterion,
  setCriterion,
  setLevel,
  setPassScore,
  setSettings,
  setWeight,
  toggleStudentVisible,
  type ReadAloudDocument,
} from './edits';

const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;
const LEVELS = [3, 2, 1, 0] as const;

/** `ra-lvl` colours: the top level green, the bottom red. */
const LEVEL_TONE: Record<(typeof LEVELS)[number], string> = {
  3: 'bg-(--ssz-color-success-50) text-(--ssz-color-success-700)',
  2: 'bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)',
  1: 'bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)',
  0: 'bg-(--ssz-color-error-50) text-(--ssz-color-error-700)',
};

export interface StepRubricProps {
  exercise: ReadAloudDocument;
  onChange: (next: ReadAloudDocument) => void;
}

/**
 * Step 3: the rubric (plan 70 §7.4). A person grades every recording, so this is the exercise's
 * only key — criteria with a weight and four level descriptors, the pass mark out of
 * `Σ 3 × weight`, and when the student gets to see the rubric and the model reading.
 *
 * Two to five criteria; the kernel refuses a sixth and a first, so the buttons are disabled here
 * to say so rather than to enforce it.
 */
export function StepRubric({ exercise, onChange }: StepRubricProps) {
  const t = useTranslations('Authoring.readAloud');
  const [open, setOpen] = useState<string | null>(exercise.rubric[0]?.id ?? null);
  const max = rubricMax(exercise.rubric);
  const pass = exercise.settings.passScore;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step3.eyebrow')} title={t('step3.title')} lede={t('step3.lede')} />

      <div
        className="flex items-center gap-4 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-4 py-3"
        style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
      >
        <div>
          <span className="text-2xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {pass}
            <i className="text-base font-medium text-(--ssz-text-muted) not-italic"> / {max}</i>
          </span>
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('step3.pointsToPass')}</p>
        </div>
        <div className="min-w-0 flex-1">
          <Bar value={(pass / Math.max(1, max)) * 100} label={t('step3.passBar')} />
        </div>
        <Input
          type="number"
          min={0}
          max={max}
          aria-label={t('step3.passLabel')}
          className="w-[74px]"
          value={pass}
          onChange={(event) => onChange(setPassScore(exercise, Number(event.target.value)))}
        />
      </div>

      {exercise.rubric.map((criterion, index) => (
        <CriterionCard
          key={criterion.id}
          exercise={exercise}
          criterion={criterion}
          index={index + 1}
          expanded={open === criterion.id}
          onToggle={() => setOpen(open === criterion.id ? null : criterion.id)}
          onChange={onChange}
        />
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          disabled={exercise.rubric.length >= RA_MAX_CRITERIA}
          onClick={() => onChange(addCriterion(exercise))}
        >
          <Plus className="size-4" aria-hidden />
          {t('step3.addCriterion')}
        </Button>
      </div>

      <Card>
        <Field label={t('step3.showRubricLabel')}>
          <Segmented
            aria-label={t('step3.showRubricLabel')}
            value={exercise.settings.showRubric}
            onValueChange={(showRubric) => onChange(setSettings(exercise, { showRubric }))}
            options={SHOW_RUBRIC.map((value) => ({ value, label: t(`step3.showRubric.${value}`) }))}
          />
        </Field>
        <Field label={t('step3.showModelLabel')}>
          <Segmented
            aria-label={t('step3.showModelLabel')}
            value={exercise.settings.showModel}
            onValueChange={(showModel) => onChange(setSettings(exercise, { showModel }))}
            options={SHOW_MODEL.map((value) => ({ value, label: t(`step3.showModel.${value}`) }))}
          />
        </Field>
      </Card>
    </div>
  );
}

function CriterionCard({
  exercise,
  criterion,
  index,
  expanded,
  onToggle,
  onChange,
}: {
  exercise: ReadAloudDocument;
  criterion: Criterion;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: ReadAloudDocument) => void;
}) {
  const t = useTranslations('Authoring.readAloud');
  const noName = criterion.name.trim() === '';
  const label = noName ? t('step3.criterionNo', { index }) : criterion.name;
  const ToggleIcon = expanded ? ChevronDown : Eye;

  return (
    <section
      aria-label={label}
      className={`rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) ${
        noName ? 'border-(--ssz-color-error-500)' : 'border-(--ssz-border-default)'
      }`}
      style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-2 pl-3">
        <Input
          aria-label={t('step3.nameLabel', { index })}
          aria-invalid={noName}
          hasError={noName}
          className="max-w-[200px] px-2 py-[5px]"
          value={criterion.name}
          onChange={(event) =>
            onChange(setCriterion(exercise, criterion.id, { name: event.target.value }))
          }
        />
        <Segmented
          size="sm"
          aria-label={t('step3.weightLabel', { label })}
          value={String(criterion.weight) as '1' | '2'}
          onValueChange={(value) =>
            onChange(setWeight(exercise, criterion.id, Number(value) as CriterionWeight))
          }
          options={[
            { value: '1', label: '×1' },
            { value: '2', label: '×2' },
          ]}
        />
        <span className="flex-1" />
        <button
          type="button"
          aria-pressed={criterion.studentVisible}
          onClick={() => onChange(toggleStudentVisible(exercise, criterion.id))}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
            criterion.studentVisible
              ? 'border-(--ssz-color-success-200) bg-(--ssz-color-success-50) text-(--ssz-color-success-700)'
              : 'border-(--ssz-border-default) bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)'
          }`}
        >
          {criterion.studentVisible ? t('step3.visible') : t('step3.teacherOnly')}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={expanded}
          aria-label={t('step3.expand', { label })}
          onClick={onToggle}
        >
          <ToggleIcon className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)"
          disabled={exercise.rubric.length <= RA_MIN_CRITERIA}
          aria-label={t('step3.removeCriterion', { label })}
          onClick={() => onChange(removeCriterion(exercise, criterion.id))}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Input
          aria-label={t('step3.descLabel', { label })}
          value={criterion.desc}
          placeholder={t('step3.descPlaceholder')}
          onChange={(event) =>
            onChange(setCriterion(exercise, criterion.id, { desc: event.target.value }))
          }
        />
        {expanded ? (
          <div
            className="grid items-center gap-x-2.5 gap-y-2"
            style={{ gridTemplateColumns: '36px minmax(0, 1fr)' }}
          >
            {LEVELS.map((level) => (
              <div key={level} className="contents">
                <span
                  aria-hidden="true"
                  className={`grid h-[26px] w-[30px] place-items-center rounded-(--ssz-radius-sm) text-[11px] font-bold ${LEVEL_TONE[level]}`}
                  style={MONO}
                >
                  {level}
                </span>
                <Input
                  aria-label={t('step3.levelLabel', { label, level })}
                  value={criterion.levels[level]}
                  placeholder={t('step3.levelPlaceholder', { level })}
                  onChange={(event) =>
                    onChange(setLevel(exercise, criterion.id, level, event.target.value))
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs text-(--ssz-text-muted)">
            {t('step3.collapsed', {
              top: criterion.levels[3] === '' ? '…' : criterion.levels[3],
              bottom: criterion.levels[0] === '' ? '…' : criterion.levels[0],
            })}
          </p>
        )}
      </div>
    </section>
  );
}
