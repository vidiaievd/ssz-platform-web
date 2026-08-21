'use client';

import { useState } from 'react';
import {
  useFieldArray,
  useController,
  useWatch,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { checkShortAnswer, type DiffToken } from '@/lib/exercises/short-answer-diff';
import { cn } from '@/lib/utils';

import {
  EXERCISE_TYPES,
  DIFFICULTY_LEVELS,
  SENTENCE_SCHEMA_TYPES,
  TEXT_ORDER_KINDS,
  RATIONALE_VERDICTS,
  countBlanks,
  splitChunks,
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
export function ExerciseFields({
  control,
  register,
  errors,
  isPending,
  typeDisabled,
}: ExerciseFieldsProps) {
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

        <Field
          label={t('difficultyLevel')}
          htmlFor="ex-difficulty"
          error={errors.difficultyLevel?.message}
        >
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

      <Field
        label={t('instructions')}
        htmlFor="ex-instructions"
        error={errors.instructions?.message}
        hint={t('instructionsHint')}
        required
      >
        <Textarea
          id="ex-instructions"
          rows={2}
          placeholder={t('instructionsPlaceholder')}
          disabled={isPending}
          {...register('instructions')}
        />
      </Field>

      <Field label={t('hint')} htmlFor="ex-hint">
        <Input
          id="ex-hint"
          placeholder={t('hintPlaceholder')}
          disabled={isPending}
          {...register('hint')}
        />
      </Field>

      {templateCode === 'multiple_choice' && (
        <MultipleChoiceFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'multiple_choice_group' && (
        <MultipleChoiceGroupFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'fill_in_blank' && (
        <FillInBlankFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'short_answer' && (
        <ShortAnswerFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'writing_task' && (
        <WritingTaskFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'sentence_schema' && (
        <SentenceSchemaFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'word_bank_fill' && (
        <WordBankFillFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
      )}
      {templateCode === 'text_order' && (
        <TextOrderFields
          control={control}
          register={register}
          errors={errors}
          isPending={isPending}
        />
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
        <Input
          id="ex-mc-ctx"
          placeholder={t('mcContextPlaceholder')}
          disabled={isPending}
          {...register('mcContext')}
        />
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
                else if (
                  correctIndexCtrl.field.value !== undefined &&
                  correctIndexCtrl.field.value > index
                )
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

/**
 * multiple_choice_group — a set of questions answered and checked as one block.
 *
 * Most blocks are a table: every question picks from the same column (Riktig /
 * Galt), which is why the shared options are authored once at the top. A
 * question that needs its own wording — "what does this word mean?" — opts out
 * and carries options of its own; an empty own-options list is what says "use
 * the shared column", matching the JSON contract exactly.
 */
function MultipleChoiceGroupFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const sharedArr = useFieldArray({ control, name: 'mcgSharedOptions' });
  const itemsArr = useFieldArray({ control, name: 'mcgItems' });
  // Watched so each question's correct-answer radios follow the shared column
  // as the author types it.
  const sharedOptions = useWatch({ control, name: 'mcgSharedOptions' }) ?? [];

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('mcgContext')} htmlFor="ex-mcg-ctx">
        <Input
          id="ex-mcg-ctx"
          placeholder={t('mcgContextPlaceholder')}
          disabled={isPending}
          {...register('mcgContext')}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('mcgSharedOptions')}</p>
        <p className="text-xs text-(--ssz-text-muted)">{t('mcgSharedOptionsHint')}</p>
        {typeof errors.mcgSharedOptions?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.mcgSharedOptions.message}</p>
        )}
        {sharedArr.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder={t('mcgOptionPlaceholder')}
                disabled={isPending}
                {...register(`mcgSharedOptions.${index}.text`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => sharedArr.remove(index)}
              disabled={sharedArr.fields.length <= 2}
              aria-label={t('removeOption')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => sharedArr.append({ text: '' })}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addOption')}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('mcgQuestions')}</p>
        <p className="text-xs text-(--ssz-text-muted)">{t('mcgQuestionsHint')}</p>
        {typeof errors.mcgItems?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.mcgItems.message}</p>
        )}

        {itemsArr.fields.map((field, index) => (
          <McgQuestion
            key={field.id}
            control={control}
            register={register}
            errors={errors}
            isPending={isPending}
            index={index}
            sharedOptions={sharedOptions}
            canRemove={itemsArr.fields.length > 1}
            onRemove={() => itemsArr.remove(index)}
          />
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            itemsArr.append({ question: '', options: [], correctIndex: 0, explanation: '' })
          }
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('mcgAddQuestion')}
        </Button>
      </div>
    </div>
  );
}

/** One question of a multiple_choice_group, with its own nested option array. */
function McgQuestion({
  control,
  register,
  errors,
  isPending,
  index,
  sharedOptions,
  canRemove,
  onRemove,
}: SubProps & {
  index: number;
  sharedOptions: Array<{ text: string }>;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: `mcgItems.${index}.options` });
  const correctCtrl = useController({ control, name: `mcgItems.${index}.correctIndex` });
  const ownOptions = useWatch({ control, name: `mcgItems.${index}.options` }) ?? [];
  const itemErrors = errors.mcgItems?.[index];
  const usesShared = fields.length === 0;
  const correctIndex = correctCtrl.field.value ?? 0;

  return (
    <div className="space-y-2 rounded-md bg-(--ssz-bg-muted) p-2.5">
      <div className="flex items-start gap-2">
        <span className="w-6 shrink-0 pt-2 text-xs font-mono text-(--ssz-text-muted)">
          {index + 1}.
        </span>
        <div className="flex-1">
          <Textarea
            rows={2}
            placeholder={t('mcgQuestionPlaceholder')}
            hasError={!!itemErrors?.question}
            disabled={isPending}
            {...register(`mcgItems.${index}.question`)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={t('mcgRemoveQuestion')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5 pl-8">
        {typeof itemErrors?.options?.message === 'string' && (
          <p className="text-xs text-destructive">{itemErrors.options.message}</p>
        )}
        {typeof itemErrors?.correctIndex?.message === 'string' && (
          <p className="text-xs text-destructive">{itemErrors.correctIndex.message}</p>
        )}

        {usesShared ? (
          <>
            {sharedOptions.length === 0 ? (
              <p className="text-xs text-(--ssz-text-muted)">{t('mcgNoSharedOptions')}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sharedOptions.map((option, j) => (
                  <label key={j} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={correctIndex === j}
                      onChange={() => correctCtrl.field.onChange(j)}
                      disabled={isPending}
                      aria-label={t('mcgCorrect')}
                    />
                    <span className="text-(--ssz-text-primary)">
                      {option.text.trim() || t('mcgOptionFallback', { n: j + 1 })}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                append([{ text: '' }, { text: '' }]);
                correctCtrl.field.onChange(0);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t('mcgOwnOptions')}
            </Button>
          </>
        ) : (
          <>
            {fields.map((field, j) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4 shrink-0 accent-primary"
                  checked={correctIndex === j}
                  onChange={() => correctCtrl.field.onChange(j)}
                  disabled={isPending}
                  aria-label={t('mcgCorrect')}
                />
                <div className="flex-1">
                  <Input
                    placeholder={t('mcgOptionPlaceholder')}
                    hasError={!!itemErrors?.options?.[j]?.text}
                    disabled={isPending}
                    {...register(`mcgItems.${index}.options.${j}.text`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    remove(j);
                    if (correctIndex === j) correctCtrl.field.onChange(0);
                    else if (correctIndex > j) correctCtrl.field.onChange(correctIndex - 1);
                  }}
                  disabled={ownOptions.length <= 2}
                  aria-label={t('removeOption')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => append({ text: '' })}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('addOption')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  remove();
                  correctCtrl.field.onChange(0);
                }}
              >
                {t('mcgUseSharedOptions')}
              </Button>
            </div>
          </>
        )}

        <Input
          placeholder={t('mcgExplanationPlaceholder')}
          disabled={isPending}
          aria-label={t('mcgExplanation')}
          {...register(`mcgItems.${index}.explanation`)}
        />
      </div>
    </div>
  );
}

// The matrix is authored identically for `fill_in_blank` and `word_bank_fill`,
// but the two store it at different paths — these are the two shapes the editor
// below accepts. Both resolve to the same element type, so one `useFieldArray`
// serves both.
type RationaleExplanationPath =
  | `fibBlanks.${number}.rationaleExplanation`
  | `wbfSentences.${number}.rationales.${number}.explanation`;

type RationaleOptionsPath =
  | `fibBlanks.${number}.rationaleOptions`
  | `wbfSentences.${number}.rationales.${number}.options`;

/**
 * Optional per-blank explanation matrix. Collapsed by default so simple drills
 * stay simple — it only expands when the author asks for it or one already
 * exists. Lives in its own component because the nested field array needs its
 * own hook call.
 */
function BlankRationaleEditor({
  control,
  register,
  isPending,
  domId,
  explanationName,
  optionsName,
}: Pick<SubProps, 'control' | 'register' | 'isPending'> & {
  domId: string;
  explanationName: RationaleExplanationPath;
  optionsName: RationaleOptionsPath;
}) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: optionsName });
  const explanation = useWatch({ control, name: explanationName });
  const hasContent = fields.length > 0 || Boolean(explanation);
  const [open, setOpen] = useState(hasContent);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t('fibAddRationale')}
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3 space-y-3">
      <p className="text-xs font-medium text-(--ssz-text-primary)">{t('fibRationale')}</p>
      <p className="text-xs text-(--ssz-text-muted)">{t('fibRationaleHint')}</p>

      <Field label={t('fibRationaleExplanation')} htmlFor={domId}>
        <Textarea
          id={domId}
          rows={2}
          placeholder={t('fibRationaleExplanationPlaceholder')}
          disabled={isPending}
          {...register(explanationName)}
        />
      </Field>

      {fields.map((field, optionIndex) => (
        <div key={field.id} className="flex items-start gap-2">
          <Input
            className="w-32 shrink-0"
            placeholder={t('fibRationaleOptionPlaceholder')}
            disabled={isPending}
            aria-label={t('fibRationaleOption')}
            {...register(`${optionsName}.${optionIndex}.text`)}
          />
          <select
            className="h-9 shrink-0 rounded-md border border-border bg-transparent px-2 text-sm"
            disabled={isPending}
            aria-label={t('fibRationaleVerdict')}
            {...register(`${optionsName}.${optionIndex}.verdict`)}
          >
            {RATIONALE_VERDICTS.map((verdict) => (
              <option key={verdict} value={verdict}>
                {t(`fibVerdict.${verdict}`)}
              </option>
            ))}
          </select>
          <Input
            placeholder={t('fibRationaleNotePlaceholder')}
            disabled={isPending}
            aria-label={t('fibRationaleNote')}
            {...register(`${optionsName}.${optionIndex}.note`)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(optionIndex)}
            aria-label={t('fibRemoveRationaleOption')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => append({ text: '', verdict: 'wrong', note: '' })}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t('fibAddRationaleOption')}
      </Button>
    </div>
  );
}

function FillInBlankFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'fibBlanks' });

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field
        label={t('fibText')}
        htmlFor="ex-fib-text"
        error={errors.fibText?.message}
        hint={t('fibTextHint')}
        required
      >
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
          <div key={field.id} className="space-y-2">
            <div className="flex items-center gap-2">
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
            <div className="pl-18">
              <BlankRationaleEditor
                control={control}
                register={register}
                isPending={isPending}
                domId={`ex-fib-rat-${index}`}
                explanationName={`fibBlanks.${index}.rationaleExplanation`}
                optionsName={`fibBlanks.${index}.rationaleOptions`}
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ answers: '', rationaleExplanation: '', rationaleOptions: [] })}
        >
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

function ShortAnswerKeyTrial({
  control,
  isPending,
  accepted,
  onAddPhrasing,
}: Pick<SubProps, 'control' | 'isPending'> & {
  accepted: string;
  onAddPhrasing: (phrasing: string) => void;
}) {
  const t = useTranslations('Authoring.exercises');
  const [trial, setTrial] = useState('');

  const referenceAnswer = useWatch({ control, name: 'saReferenceAnswer' }) ?? '';

  const result = trial.trim()
    ? checkShortAnswer(
        { reference_answer: referenceAnswer, accepted_answers: splitChunks(accepted) },
        trial,
      )
    : null;

  return (
    <div className="rounded-md border border-dashed border-border p-3 space-y-2">
      <Field label={t('saTrial')} htmlFor="ex-sa-trial" hint={t('saTrialHint')}>
        <Input
          id="ex-sa-trial"
          value={trial}
          onChange={(e) => setTrial(e.target.value)}
          placeholder={t('saTrialPlaceholder')}
          disabled={isPending}
        />
      </Field>

      {result && (
        <div className="space-y-2">
          <p className="text-xs font-medium">
            {result.ok === true
              ? t('saTrialAccepted')
              : result.ok === false
                ? t('saTrialMarkedWrong', { score: result.score })
                : t('saTrialReview')}
          </p>

          {result.ok === false && (
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm">
              {result.tokens.map((token, i) => (
                <TrialWord key={`${i}-${token.submitted ?? token.expected ?? ''}`} token={token} />
              ))}
            </p>
          )}

          {result.ok !== true && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => onAddPhrasing(trial.trim())}
            >
              {t('saTrialAddPhrasing')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The learner-facing markup, in the authoring surface's own type and tokens. */
function TrialWord({ token }: { token: DiffToken }) {
  const t = useTranslations('Authoring.exercises');

  if (token.outcome === 'ok') return <span>{token.submitted}</span>;

  if (token.outcome === 'missing') {
    return (
      <span
        title={t('saTrialMissing')}
        className="text-success-700 underline decoration-dashed underline-offset-2 dark:text-success-400"
      >
        {token.expected}
      </span>
    );
  }

  if (token.outcome === 'extra') {
    return (
      <span title={t('saTrialExtra')} className="text-error-700 line-through dark:text-error-400">
        {token.submitted}
      </span>
    );
  }

  const isForm = token.outcome === 'form';
  return (
    <span title={isForm ? t('saTrialForm') : t('saTrialWrong')}>
      <span
        className={cn(
          'text-error-700 underline-offset-2 dark:text-error-400',
          isForm ? 'underline decoration-wavy' : 'line-through',
        )}
      >
        {token.submitted}
      </span>
      <span className="text-(--ssz-text-muted)"> → </span>
      <span className="font-semibold text-success-700 dark:text-success-400">{token.expected}</span>
    </span>
  );
}

function ShortAnswerFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  /* Controlled rather than registered: the trial panel below appends to this
     field, and an uncontrolled input would keep showing the stale text. */
  const acceptedCtrl = useController({ control, name: 'saAccepted' });
  const accepted = acceptedCtrl.field.value ?? '';

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('saQuestion')} htmlFor="ex-sa-q" error={errors.saQuestion?.message} required>
        <Textarea
          id="ex-sa-q"
          rows={2}
          placeholder={t('saQuestionPlaceholder')}
          disabled={isPending}
          {...register('saQuestion')}
        />
      </Field>

      <Field label={t('saContext')} htmlFor="ex-sa-ctx">
        <Input
          id="ex-sa-ctx"
          placeholder={t('saContextPlaceholder')}
          disabled={isPending}
          {...register('saContext')}
        />
      </Field>

      <Field
        label={t('saReferenceAnswer')}
        htmlFor="ex-sa-ref"
        error={errors.saReferenceAnswer?.message}
        hint={t('saReferenceAnswerHint')}
        required
      >
        <Textarea
          id="ex-sa-ref"
          rows={2}
          placeholder={t('saReferenceAnswerPlaceholder')}
          disabled={isPending}
          {...register('saReferenceAnswer')}
        />
      </Field>

      <Field label={t('saAccepted')} htmlFor="ex-sa-acc" hint={t('saAcceptedHint')}>
        <Input
          id="ex-sa-acc"
          value={accepted}
          onChange={(e) => acceptedCtrl.field.onChange(e.target.value)}
          onBlur={acceptedCtrl.field.onBlur}
          placeholder={t('saAcceptedPlaceholder')}
          disabled={isPending}
        />
      </Field>

      <ShortAnswerKeyTrial
        control={control}
        isPending={isPending}
        accepted={accepted}
        onAddPhrasing={(phrasing) =>
          acceptedCtrl.field.onChange(
            accepted.trim() ? `${accepted.trim()} | ${phrasing}` : phrasing,
          )
        }
      />
    </div>
  );
}

function WritingTaskFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'wtTopics' });

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('wtPrompt')} htmlFor="ex-wt-prompt" error={errors.wtPrompt?.message} required>
        <Textarea
          id="ex-wt-prompt"
          rows={2}
          placeholder={t('wtPromptPlaceholder')}
          disabled={isPending}
          {...register('wtPrompt')}
        />
      </Field>

      <Field label={t('wtMinWords')} htmlFor="ex-wt-min">
        <Input
          id="ex-wt-min"
          type="number"
          min={0}
          className="max-w-32"
          placeholder={t('wtMinWordsPlaceholder')}
          disabled={isPending}
          {...register('wtMinWords')}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('wtTopics')}</p>
        <p className="text-xs text-muted-foreground">{t('wtTopicsHint')}</p>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder={t('wtTopicPlaceholder')}
                disabled={isPending}
                {...register(`wtTopics.${index}.title`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              aria-label={t('removeTopic')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ title: '' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addTopic')}
        </Button>
      </div>

      <Field label={t('wtRubric')} htmlFor="ex-wt-rubric" hint={t('wtRubricHint')}>
        <Textarea
          id="ex-wt-rubric"
          rows={2}
          placeholder={t('wtRubricPlaceholder')}
          disabled={isPending}
          {...register('wtRubric')}
        />
      </Field>
    </div>
  );
}

function SentenceSchemaFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const typeCtrl = useController({ control, name: 'ssSchemaType' });
  const fieldsArr = useFieldArray({ control, name: 'ssFields' });
  const tokensArr = useFieldArray({ control, name: 'ssTokens' });
  // Watch field labels so each token's field selector stays in sync.
  const watchedFields = useWatch({ control, name: 'ssFields' }) ?? [];

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field
        label={t('ssSentence')}
        htmlFor="ex-ss-sentence"
        error={errors.ssSentence?.message}
        required
      >
        <Input
          id="ex-ss-sentence"
          placeholder={t('ssSentencePlaceholder')}
          disabled={isPending}
          {...register('ssSentence')}
        />
      </Field>

      <Field
        label={t('ssSourceSentence')}
        htmlFor="ex-ss-source"
        hint={t('ssSourceSentenceHelp')}
        error={errors.ssSourceSentence?.message}
      >
        <Input
          id="ex-ss-source"
          placeholder={t('ssSourceSentencePlaceholder')}
          disabled={isPending}
          {...register('ssSourceSentence')}
        />
      </Field>

      <Field label={t('ssSchemaType')} htmlFor="ex-ss-type">
        <Select
          value={typeCtrl.field.value ?? 'main'}
          onValueChange={(v) =>
            typeCtrl.field.onChange(v as (typeof SENTENCE_SCHEMA_TYPES)[number])
          }
          disabled={isPending}
        >
          <SelectTrigger id="ex-ss-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SENTENCE_SCHEMA_TYPES.map((st) => (
              <SelectItem key={st} value={st}>
                {t(`ssSchemaType_${st}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Fields (ordered columns of the schema) */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('ssFields')}</p>
        {typeof errors.ssFields?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.ssFields.message}</p>
        )}
        {fieldsArr.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-xs font-mono text-(--ssz-text-muted)">
              {index + 1}
            </span>
            <div className="flex-1">
              <Input
                placeholder={t('ssFieldPlaceholder')}
                disabled={isPending}
                {...register(`ssFields.${index}.label`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fieldsArr.remove(index)}
              disabled={fieldsArr.fields.length <= 2}
              aria-label={t('removeField')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fieldsArr.append({ label: '' })}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addField')}
        </Button>
      </div>

      {/* Tokens (words) + their target field */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('ssTokens')}</p>
        <p className="text-xs text-muted-foreground">{t('ssTokensHint')}</p>
        {typeof errors.ssTokens?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.ssTokens.message}</p>
        )}
        {tokensArr.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder={t('ssTokenPlaceholder')}
                disabled={isPending}
                {...register(`ssTokens.${index}.text`)}
              />
            </div>
            <span className="text-(--ssz-text-muted)">→</span>
            <select
              className="h-9 rounded-md border border-(--ssz-border-default) bg-surface px-2 text-sm text-(--ssz-text-primary)"
              disabled={isPending}
              aria-label={t('ssTokenField')}
              {...register(`ssTokens.${index}.fieldIndex`, { valueAsNumber: true })}
            >
              {watchedFields.map((f, fi) => (
                <option key={fi} value={fi}>
                  {f.label.trim() || t('ssFieldFallback', { n: fi + 1 })}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => tokensArr.remove(index)}
              disabled={tokensArr.fields.length <= 2}
              aria-label={t('removeToken')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => tokensArr.append({ text: '', fieldIndex: 0 })}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('addToken')}
        </Button>
      </div>
    </div>
  );
}

/**
 * word_bank_fill — one shared bank plus a list of sentences. The number of
 * answer inputs per sentence follows the ___N___ markers the author typed, so
 * a sentence with two blanks grows a second input on its own.
 */
function WordBankFillFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'wbfSentences' });
  const sentences = useWatch({ control, name: 'wbfSentences' });

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field
        label={t('wbfWordBank')}
        htmlFor="ex-wbf-bank"
        error={errors.wbfWordBank?.message}
        hint={t('wbfWordBankHint')}
        required
      >
        <Textarea
          id="ex-wbf-bank"
          rows={2}
          placeholder={t('wbfWordBankPlaceholder')}
          disabled={isPending}
          {...register('wbfWordBank')}
        />
      </Field>

      <div className="space-y-3">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('wbfSentences')}</p>
        <p className="text-xs text-(--ssz-text-muted)">{t('wbfSentencesHint')}</p>
        {typeof errors.wbfSentences?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.wbfSentences.message}</p>
        )}

        {fields.map((field, index) => {
          const text = sentences?.[index]?.text ?? '';
          const blanks = countBlanks(text);

          return (
            <div key={field.id} className="space-y-2 rounded-md bg-(--ssz-bg-muted) p-2.5">
              <div className="flex items-start gap-2">
                <span className="w-6 shrink-0 pt-2 text-xs font-mono text-(--ssz-text-muted)">
                  {index + 1}.
                </span>
                <div className="flex-1">
                  <Textarea
                    rows={2}
                    placeholder={t('wbfSentencePlaceholder')}
                    className="font-mono text-sm"
                    hasError={!!errors.wbfSentences?.[index]?.text}
                    disabled={isPending}
                    {...register(`wbfSentences.${index}.text`)}
                  />
                  {errors.wbfSentences?.[index]?.text?.message && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.wbfSentences[index].text.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  aria-label={t('wbfRemoveSentence')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {Array.from({ length: blanks }, (_, j) => (
                <div key={j} className="space-y-2 pl-8">
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-mono text-(--ssz-text-muted)">
                      {t('fibBlankLabel', { n: j + 1 })}
                    </span>
                    <Input
                      placeholder={t('wbfAnswersPlaceholder')}
                      hasError={!!errors.wbfSentences?.[index]?.answers?.[j]}
                      disabled={isPending}
                      {...register(`wbfSentences.${index}.answers.${j}`)}
                    />
                  </div>
                  <div className="pl-18">
                    <BlankRationaleEditor
                      control={control}
                      register={register}
                      isPending={isPending}
                      domId={`ex-wbf-rat-${index}-${j}`}
                      explanationName={`wbfSentences.${index}.rationales.${j}.explanation`}
                      optionsName={`wbfSentences.${index}.rationales.${j}.options`}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ text: '', answers: [''], rationales: [] })}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('wbfAddSentence')}
        </Button>
      </div>

      <WordNotesEditor
        control={control}
        register={register}
        errors={errors}
        isPending={isPending}
      />
    </div>
  );
}

/**
 * Notes on the bank words themselves — shown as feedback when the learner picks
 * that word, in any sentence. Separate from the per-blank matrix above: in a
 * drill on at / om the reason a word fits does not change from sentence to
 * sentence, so it is authored once here.
 */
function WordNotesEditor({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'wbfWordNotes' });

  if (fields.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => append({ word: '', note: '' })}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t('wbfAddWordNote')}
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3 space-y-3">
      <p className="text-xs font-medium text-(--ssz-text-primary)">{t('wbfWordNotes')}</p>
      <p className="text-xs text-(--ssz-text-muted)">{t('wbfWordNotesHint')}</p>

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <div className="w-32 shrink-0">
            <Input
              placeholder={t('wbfWordNoteWordPlaceholder')}
              hasError={!!errors.wbfWordNotes?.[index]?.word}
              disabled={isPending}
              aria-label={t('wbfWordNoteWord')}
              {...register(`wbfWordNotes.${index}.word`)}
            />
            {errors.wbfWordNotes?.[index]?.word?.message && (
              <p className="mt-1 text-xs text-destructive">
                {errors.wbfWordNotes[index].word.message}
              </p>
            )}
          </div>
          <Input
            placeholder={t('wbfWordNoteNotePlaceholder')}
            disabled={isPending}
            aria-label={t('wbfWordNoteNote')}
            {...register(`wbfWordNotes.${index}.note`)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            aria-label={t('wbfRemoveWordNote')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => append({ word: '', note: '' })}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t('wbfAddWordNote')}
      </Button>
    </div>
  );
}

/**
 * text_order — the list order is the correct order; the runner shuffles it for
 * the learner, so authors read the dialogue top to bottom while editing.
 */
function TextOrderFields({ control, register, errors, isPending }: SubProps) {
  const t = useTranslations('Authoring.exercises');
  const { fields, append, remove } = useFieldArray({ control, name: 'toLines' });
  const kindCtrl = useController({ control, name: 'toKind' });
  const isDialogue = (kindCtrl.field.value ?? 'dialogue') === 'dialogue';

  return (
    <div className="rounded-md border border-border p-3 space-y-4">
      <Field label={t('toKind')} htmlFor="ex-to-kind">
        <Select
          value={kindCtrl.field.value ?? 'dialogue'}
          onValueChange={(v) => kindCtrl.field.onChange(v as (typeof TEXT_ORDER_KINDS)[number])}
          disabled={isPending}
        >
          <SelectTrigger id="ex-to-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_ORDER_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`toKind_${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('toLines')}</p>
        <p className="text-xs text-(--ssz-text-muted)">{t('toLinesHint')}</p>
        {typeof errors.toLines?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.toLines.message}</p>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <span className="w-6 shrink-0 pt-2 text-xs font-mono text-(--ssz-text-muted)">
              {index + 1}.
            </span>
            {isDialogue && (
              <div className="w-32 shrink-0">
                <Input
                  placeholder={t('toSpeakerPlaceholder')}
                  disabled={isPending}
                  {...register(`toLines.${index}.speaker`)}
                />
              </div>
            )}
            <div className="flex-1">
              <Input
                placeholder={t('toLinePlaceholder')}
                hasError={!!errors.toLines?.[index]?.text}
                disabled={isPending}
                {...register(`toLines.${index}.text`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length <= 2}
              aria-label={t('toRemoveLine')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ text: '', speaker: '' })}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('toAddLine')}
        </Button>
      </div>
    </div>
  );
}
