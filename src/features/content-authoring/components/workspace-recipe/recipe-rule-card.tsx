'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Check, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { RECIPE_AXES, type RecipeAxis } from '@/lib/shared-kernel/skills';

import { useRecipeText } from '../../hooks/use-recipe-text';
import {
  RECIPE_VALUES,
  fromDraft,
  ruleErrors,
  setAxis,
  setBound,
  toggleValue,
  type DraftBound,
  type DraftRule,
  type RuleError,
} from '../../lib/recipe-draft';

const FIELD =
  'h-9 rounded-md border border-(--ssz-border-default) bg-(--ssz-bg-base) px-3 text-sm outline-none focus-visible:border-(--ssz-color-primary-600) focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 disabled:cursor-not-allowed disabled:text-(--ssz-text-muted)';
const FIELD_ERROR = 'border-(--ssz-color-error-500) bg-(--ssz-color-error-50)';

/** Element ids a parent may move focus to — after Add rule, and after a delete. */
export const ruleAxisId = (rule: DraftRule) => `${rule.id}-axis`;
export const ruleDeleteId = (rule: DraftRule) => `${rule.id}-delete`;

/**
 * One rule of the workspace recipe — plan 65, README §1 «Правило».
 *
 * Presentational: it holds no state, and every edit goes through `recipe-draft.ts`, so the
 * side effects the design asks for (an axis change clears the values, a bound change
 * restarts the number) happen in one place for this card and for the course drawer.
 * Without `onChange` the card is read-only.
 */
export function RecipeRuleCard({
  rule,
  number,
  change = null,
  rejected = false,
  onChange,
  onDelete,
}: {
  rule: DraftRule;
  /** One-based position; every accessible name carries it. */
  number: number;
  change?: 'new' | 'edited' | null;
  /** The service refused this rule on the last save. */
  rejected?: boolean;
  onChange?: (next: DraftRule) => void;
  onDelete?: () => void;
}) {
  const t = useTranslations('Settings.recipe.rule');
  const tErr = useTranslations('Settings.recipe.err');
  const tAxis = useTranslations('Authoring.recipe.axis');
  const text = useRecipeText();
  const uid = useId();
  const headingId = `${uid}-heading`;
  const errorId = `${uid}-error`;

  const disabled = !onChange;
  const errors = ruleErrors(rule);
  const errorOn = (field: RuleError['field']) => errors.some((e) => e.field === field);
  const broken = errors.length > 0 || rejected;
  const describedBy = broken ? errorId : undefined;

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-3 rounded-[10px] border bg-(--ssz-bg-surface) px-4 pt-3 pb-4',
        broken
          ? 'border-(--ssz-color-error-500) shadow-[inset_3px_0_0_var(--ssz-color-error-500)]'
          : change === 'new'
            ? 'border-(--ssz-color-primary-300)'
            : 'border-(--ssz-border-default)',
      )}
    >
      <div className="flex min-h-8 items-center gap-2">
        <h4
          id={headingId}
          className="text-[11px] font-bold tracking-[0.08em] text-(--ssz-text-muted) uppercase"
        >
          {t('heading', { n: number })}
        </h4>
        {change && (
          <span className="rounded-full bg-(--ssz-color-primary-50) px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-(--ssz-color-primary-700) uppercase">
            {t(change)}
          </span>
        )}
        <span className="flex-1" />
        {onDelete && (
          <button
            type="button"
            id={ruleDeleteId(rule)}
            aria-label={t('delete', { n: number })}
            onClick={onDelete}
            className="grid size-8 place-items-center rounded-md text-(--ssz-text-muted) hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700) focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 focus-visible:outline-none"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,200px)_1fr]">
        <label className="flex flex-col gap-[5px]">
          <span className="text-xs font-semibold text-(--ssz-text-secondary)">{t('countsBy')}</span>
          <select
            id={ruleAxisId(rule)}
            aria-label={t('axisLabel', { n: number })}
            className={cn(FIELD, 'pr-8')}
            value={rule.axis}
            disabled={disabled}
            onChange={(e) => onChange?.(setAxis(rule, e.target.value as RecipeAxis))}
          >
            {RECIPE_AXES.map((axis) => (
              <option key={axis} value={axis}>
                {tAxis(axis)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-[5px]">
          <span className="text-xs font-semibold text-(--ssz-text-secondary)">{t('limit')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t('boundLabel', { n: number })}
              className={cn(FIELD, 'pr-8')}
              value={rule.bound}
              disabled={disabled}
              onChange={(e) => onChange?.(setBound(rule, e.target.value as DraftBound))}
            >
              <option value="min">{t('atLeast')}</option>
              <option value="maxShare">{t('atMost')}</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              aria-label={t(rule.bound === 'min' ? 'amountMin' : 'amountShare', { n: number })}
              aria-invalid={errorOn('n') || undefined}
              aria-describedby={errorOn('n') ? describedBy : undefined}
              className={cn(FIELD, 'w-[76px] text-right tabular-nums', errorOn('n') && FIELD_ERROR)}
              value={rule.n}
              disabled={disabled}
              onChange={(e) => onChange?.({ ...rule, n: e.target.value })}
            />
            <span className="text-sm text-(--ssz-text-secondary)">
              {rule.bound === 'min' ? t('unitItems') : t('unitShare')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <fieldset
          className="min-w-0 flex-[1_1_360px]"
          aria-invalid={errorOn('values') || undefined}
          aria-describedby={errorOn('values') ? describedBy : undefined}
        >
          <legend className="mb-[5px] text-xs font-semibold text-(--ssz-text-secondary)">
            {tAxis(rule.axis)}{' '}
            <span className="font-normal text-(--ssz-text-muted)">· {t(`hint.${rule.axis}`)}</span>
            <span className="sr-only"> {t('valuesSr', { n: number })}</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {RECIPE_VALUES[rule.axis].map((value) => {
              const on = rule.values.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => onChange?.(toggleValue(rule, value))}
                  className={cn(
                    'inline-flex min-h-8 items-center gap-2 rounded-md border py-1 pr-3 pl-2 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 focus-visible:outline-none disabled:cursor-not-allowed pointer-coarse:min-h-11',
                    on
                      ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) text-(--ssz-color-primary-700)'
                      : errorOn('values')
                        ? 'border-(--ssz-color-error-100)'
                        : 'border-(--ssz-border-default)',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-4 place-items-center rounded-[4px] border-[1.5px]',
                      on
                        ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-600) text-white'
                        : 'border-(--ssz-border-strong)',
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn(on && rule.negate && 'line-through decoration-[1.5px]')}>
                    {text.valueLabel(rule.axis, value)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            role="switch"
            aria-checked={rule.negate}
            aria-label={t('notLabel', { n: number })}
            disabled={disabled}
            onClick={() => onChange?.({ ...rule, negate: !rule.negate })}
            className={cn(
              'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-180 ease-[cubic-bezier(.16,1,.3,1)] focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 focus-visible:outline-none disabled:cursor-not-allowed',
              rule.negate
                ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-600)'
                : 'border-(--ssz-border-strong) bg-(--ssz-bg-muted)',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute top-[2px] left-[2px] size-3.5 rounded-full bg-white shadow-sm transition-transform duration-180 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
                rule.negate && 'translate-x-4',
              )}
            />
          </button>
          <span aria-hidden>{t.rich('not', { b: (chunks) => <b>{chunks}</b> })}</span>
        </div>
      </div>

      <p className="rounded-md bg-(--ssz-bg-subtle) px-3 py-2" aria-live="polite">
        <span className="mr-2 text-[10px] font-bold tracking-[0.08em] text-(--ssz-text-muted) uppercase">
          {t('readsAs')}
        </span>
        <RulePhrase rule={rule} />
      </p>

      {broken && (
        <div id={errorId} role={rejected ? 'alert' : undefined} className="flex flex-col gap-1">
          {(rejected ? [tErr('rejected')] : errors.map((e) => tErr(e.key))).map((message) => (
            <p
              key={message}
              className="flex items-center gap-1.5 text-xs font-semibold text-(--ssz-color-error-700)"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              {message}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * "at least 1 item — Answer: not Nothing written". A finished rule reads exactly as the
 * dot and the triage say it; an unfinished one shows what is missing in its place.
 */
function RulePhrase({ rule }: { rule: DraftRule }) {
  const t = useTranslations('Settings.recipe.rule');
  const tAxis = useTranslations('Authoring.recipe.axis');
  const text = useRecipeText();
  const or = new Intl.ListFormat(useLocale(), { type: 'disjunction' });

  const parsed = fromDraft(rule);
  if (parsed) return <span className="text-sm font-medium">{text.rule(parsed)}</span>;

  const amount = rule.n.trim();
  const whole = /^\d+$/.test(amount);
  const bound =
    rule.bound === 'min'
      ? whole
        ? t('phraseMin', { n: Number(amount) })
        : t('phraseMinBlank')
      : t('phraseMax', { n: whole ? amount : t('blank') });

  const values = RECIPE_VALUES[rule.axis]
    .filter((v) => rule.values.includes(v))
    .map((v) => text.valueLabel(rule.axis, v));

  return (
    <span className="text-sm font-medium">
      {t.rich('phrase', {
        bound,
        target: () =>
          t.rich(rule.negate ? 'targetNot' : 'target', {
            axis: tAxis(rule.axis),
            v: () =>
              values.length > 0 ? (
                or.format(values)
              ) : (
                <em className="text-(--ssz-color-error-700)">{t('pick')}</em>
              ),
          }),
      })}
    </span>
  );
}
