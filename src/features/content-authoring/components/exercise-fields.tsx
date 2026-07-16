'use client';

import { useFieldArray, useController, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  EXERCISE_TYPES,
  DIFFICULTY_LEVELS,
  type ExerciseFormValues,
  type ExerciseType,
} from '../schemas/exercise';

const NO_DIFFICULTY_LEVEL = '__none__';

interface ExerciseFieldsProps {
  control: Control<ExerciseFormValues>;
  register: UseFormRegister<ExerciseFormValues>;
  errors: FieldErrors<ExerciseFormValues>;
  isPending: boolean;
  /** Locks the type selector (type is immutable once the exercise exists). */
  typeDisabled?: boolean;
}

/** Shared type/difficulty/instructions header + per-template fields for the 5 exercise templates. */
export function ExerciseFields({ control, register, errors, isPending, typeDisabled }: ExerciseFieldsProps) {
  const t = useTranslations('Authoring.exercises');

  const typeCtrl = useController({ control, name: 'templateCode' });
  const levelCtrl = useController({ control, name: 'difficultyLevel' });
  const templateCode = typeCtrl.field.value;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('type')} htmlFor="ex-type" error={errors.templateCode?.message} required>
          <Select
            value={typeCtrl.field.value}
            onValueChange={(v) => typeCtrl.field.onChange(v as ExerciseType)}
            disabled={typeDisabled || isPending}
          >
            <SelectTrigger id="ex-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXERCISE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t('difficultyLevel')} htmlFor="ex-difficulty" error={errors.difficultyLevel?.message}>
          <Select
            value={levelCtrl.field.value ?? NO_DIFFICULTY_LEVEL}
            onValueChange={(v) =>
              levelCtrl.field.onChange(
                v === NO_DIFFICULTY_LEVEL ? undefined : (v as (typeof DIFFICULTY_LEVELS)[number]),
              )
            }
            disabled={isPending}
          >
            <SelectTrigger id="ex-difficulty" className="w-full">
              <SelectValue placeholder={t('difficultyLevelNone')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DIFFICULTY_LEVEL}>{t('difficultyLevelNone')}</SelectItem>
              {DIFFICULTY_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t('instructions')} htmlFor="ex-instructions">
        <Textarea
          id="ex-instructions"
          rows={2}
          placeholder={t('instructionsPlaceholder')}
          disabled={isPending}
          {...register('instructions')}
        />
      </Field>

      <Field label={t('hint')} htmlFor="ex-hint">
        <Input id="ex-hint" placeholder={t('hintPlaceholder')} disabled={isPending} {...register('hint')} />
      </Field>

      {templateCode === 'multiple_choice' && (
        <MultipleChoiceFields control={control} register={register} errors={errors} isPending={isPending} />
      )}
      {templateCode === 'fill_in_blank' && (
        <FillInBlankFields control={control} register={register} errors={errors} isPending={isPending} />
      )}
      {(templateCode === 'translate_to_target' || templateCode === 'translate_from_target') && (
        <TranslateFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
          showSourceLanguage={templateCode === 'translate_to_target'}
        />
      )}
      {templateCode === 'match_pairs' && (
        <MatchPairsFields control={control} register={register} errors={errors} isPending={isPending} />
      )}
    </div>
  );
}

type SubProps = Pick<ExerciseFieldsProps, 'control' | 'register' | 'errors' | 'isPending'>;

function MultipleChoiceFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'mcOptions' });
  const correctIndexCtrl = useController({ control, name: 'mcCorrectIndex' });

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('mcQuestion')} htmlFor="ex-mc-q" error={errors.mcQuestion?.message} required>
        <Textarea
          id="ex-mc-q"
          rows={2}
          placeholder={t('mcQuestionPlaceholder')}
          disabled={isPending}
          {...register('mcQuestion')}
        />
      </Field>

      <Field label={t('mcContext')} htmlFor="ex-mc-ctx">
        <Input id="ex-mc-ctx" placeholder={t('mcContextPlaceholder')} disabled={isPending} {...register('mcContext')} />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('mcOptions')}</p>
        {typeof errors.mcOptions?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.mcOptions.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              type="radio"
              className="h-4 w-4 shrink-0 accent-primary"
              checked={correctIndexCtrl.field.value === index}
              onChange={() => correctIndexCtrl.field.onChange(index)}
              aria-label={t('mcCorrect')}
            />
            <div className="flex-1">
              <Input
                placeholder={t('mcOptionPlaceholder')}
                hasError={!!errors.mcOptions?.[index]?.text}
                disabled={isPending}
                {...register(`mcOptions.${index}.text`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                remove(index);
                if (correctIndexCtrl.field.value === index) correctIndexCtrl.field.onChange(0);
                else if (correctIndexCtrl.field.value !== undefined && correctIndexCtrl.field.value > index)
                  correctIndexCtrl.field.onChange(correctIndexCtrl.field.value - 1);
              }}
              disabled={fields.length <= 2}
              aria-label={t('removeOption')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ text: '' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addOption')}
        </Button>
      </div>
    </div>
  );
}

function FillInBlankFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'fibBlanks' });

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('fibText')} htmlFor="ex-fib-text" error={errors.fibText?.message} hint={t('fibTextHint')} required>
        <Textarea
          id="ex-fib-text"
          rows={3}
          placeholder={t('fibTextPlaceholder')}
          className="font-mono text-sm"
          disabled={isPending}
          {...register('fibText')}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('fibBlanks')}</p>
        {typeof errors.fibBlanks?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.fibBlanks.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-mono text-(--ssz-text-muted)">
              {t('fibBlankLabel', { n: index + 1 })}
            </span>
            <div className="flex-1">
              <Input
                placeholder={t('fibAnswersPlaceholder')}
                hasError={!!errors.fibBlanks?.[index]?.answers}
                disabled={isPending}
                {...register(`fibBlanks.${index}.answers`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
              aria-label={t('removeBlank')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ answers: '' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addBlank')}
        </Button>
      </div>

      <Field label={t('fibWordBank')} htmlFor="ex-fib-bank">
        <Input
          id="ex-fib-bank"
          placeholder={t('fibWordBankPlaceholder')}
          disabled={isPending}
          {...register('fibWordBank')}
        />
      </Field>
    </div>
  );
}

function TranslateFields({
  control,
  register,
  errors,
  isPending,
  showSourceLanguage,
}: SubProps & { showSourceLanguage: boolean }) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'trAcceptedTranslations' });

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('trSourceText')} htmlFor="ex-tr-src" error={errors.trSourceText?.message} required>
        <Textarea
          id="ex-tr-src"
          rows={2}
          placeholder={t('trSourceTextPlaceholder')}
          disabled={isPending}
          {...register('trSourceText')}
        />
      </Field>

      {showSourceLanguage && (
        <Field label={t('trSourceLanguage')} htmlFor="ex-tr-lang">
          <Input
            id="ex-tr-lang"
            placeholder={t('trSourceLanguagePlaceholder')}
            className="max-w-32 font-mono"
            disabled={isPending}
            {...register('trSourceLanguage')}
          />
        </Field>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('trAcceptedTranslations')}</p>
        {typeof errors.trAcceptedTranslations?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.trAcceptedTranslations.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder={t('trTranslationPlaceholder')}
                hasError={!!errors.trAcceptedTranslations?.[index]?.text}
                disabled={isPending}
                {...register(`trAcceptedTranslations.${index}.text`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
              aria-label={t('removeTranslation')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ text: '' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addTranslation')}
        </Button>
      </div>
    </div>
  );
}

function MatchPairsFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'mpPairs' });

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className="text-sm font-medium text-(--ssz-text-primary)">{t('mpPairs')}</p>
      {typeof errors.mpPairs?.message === 'string' && (
        <p className="text-xs text-destructive">{errors.mpPairs.message}</p>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              placeholder={t('mpLeftPlaceholder')}
              hasError={!!errors.mpPairs?.[index]?.left}
              disabled={isPending}
              {...register(`mpPairs.${index}.left`)}
            />
          </div>
          <span className="text-(--ssz-text-muted)">↔</span>
          <div className="flex-1">
            <Input
              placeholder={t('mpRightPlaceholder')}
              hasError={!!errors.mpPairs?.[index]?.right}
              disabled={isPending}
              {...register(`mpPairs.${index}.right`)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            disabled={fields.length <= 2}
            aria-label={t('removePair')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => append({ left: '', right: '' })}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t('addPair')}
      </Button>
    </div>
  );
}
