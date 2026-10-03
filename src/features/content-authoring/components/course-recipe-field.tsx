'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MAX_RECIPE_RULES,
  RECIPE_AXES,
  RECIPE_PRESET_IDS,
  type RecipeAxis,
  type RecipePresetId,
} from '@/lib/shared-kernel/skills';

import type { Recipe } from '../types';
import {
  InvalidRecipeError,
  useCourseCoverageRecipe,
  useSaveCourseCoverageRecipe,
} from '../api/use-coverage-recipe';
import { useRecipeText } from '../hooks/use-recipe-text';
import {
  RECIPE_VALUES,
  fromDraft,
  newRule,
  presetDraft,
  setAxis,
  setBound,
  toDrafts,
  toRecipe,
  toggleValue,
  type DraftBound,
  type DraftRule,
} from '../lib/recipe-draft';

type Mode = 'inherit' | 'own' | 'none';

interface Draft {
  mode: Mode;
  rules: DraftRule[];
}

const SELECT =
  'rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-2 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground';

function modeOf(recipe: { overridden: boolean; recipe: Recipe }): Mode {
  if (!recipe.overridden) return 'inherit';
  return recipe.recipe.rules.length === 0 ? 'none' : 'own';
}

/**
 * What every lesson of this course is expected to train — plan 64, decisions L–P.
 *
 * Three states, the same three the response time has and for the same reason: following
 * the workspace (and keeping on following it when it changes), a recipe of the course's
 * own, and deliberately none. "None" is its own choice rather than an empty "own" list,
 * because an author who removes the last rule by accident has not opted out of a method.
 *
 * The form validates with the kernel's own reader, so the save button is never offered for
 * a recipe the service would refuse. Saving never blocks publishing — the recipe only
 * decides which lessons wear a dot.
 */
export function CourseRecipeField({
  containerId,
  canEdit = true,
}: {
  containerId: string;
  canEdit?: boolean;
}) {
  const t = useTranslations('Authoring.recipe.editor');
  const text = useRecipeText();
  const name = useId();

  const { data, isPending, isError } = useCourseCoverageRecipe(containerId);
  const save = useSaveCourseCoverageRecipe(containerId);
  // Nothing is held until somebody touches the form: until then it reads the query.
  const [draft, setDraft] = useState<Draft | null>(null);

  if (isError) return <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>;
  if (!data || isPending) return <Skeleton className="h-32 w-full rounded-lg" />;

  const current: Draft = draft ?? {
    mode: modeOf(data),
    rules: data.overridden ? toDrafts(data.recipe) : [],
  };
  const edit = (next: Partial<Draft>) => setDraft({ ...current, ...next });
  const editRule = (next: DraftRule) =>
    edit({ rules: current.rules.map((rule) => (rule.id === next.id ? next : rule)) });

  const own = current.mode === 'own' ? toRecipe(current.rules) : null;
  const invalid = current.mode === 'own' && (own === null || own.rules.length === 0);
  const outgoing: Recipe | null =
    current.mode === 'inherit' ? null : current.mode === 'none' ? { rules: [] } : own;
  const changed = draft !== null;

  const submit = () => {
    save.mutate(outgoing, {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('saved'));
      },
      onError: (error) =>
        toast.error(error instanceof InvalidRecipeError ? t('refused') : t('saveFailed')),
    });
  };

  const choose = (mode: Mode) => {
    // Turning "own" on starts from what applies now, so switching and saving at once
    // changes nothing — the same rule the response time follows.
    const rules =
      mode === 'own' && current.rules.length === 0
        ? toDrafts(data.inherited ?? data.recipe)
        : current.rules;
    edit({ mode, rules });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('lede')}</p>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
        <legend className="sr-only">{t('title')}</legend>
        {(['inherit', 'own', 'none'] as const).map((mode) => (
          <label key={mode} className="flex cursor-pointer items-start gap-2.5">
            <input
              type="radio"
              name={name}
              value={mode}
              checked={current.mode === mode}
              onChange={() => choose(mode)}
              className="mt-1 accent-(--ssz-color-primary-500)"
            />
            <span className="text-[13.5px]">
              <span className="font-semibold">{t(`mode.${mode}`)}</span>
              {mode === 'inherit' && (
                <span className="block text-[11.5px] text-muted-foreground">
                  {data.inherited === null
                    ? t('noWorkspaceRecipe')
                    : t('inheritedCount', { count: data.inherited.rules.length })}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {current.mode === 'inherit' && data.inherited && data.inherited.rules.length > 0 && (
        <ul className="space-y-1 pl-[26px] text-[12.5px] text-(--ssz-text-secondary)">
          {data.inherited.rules.map((rule, i) => (
            <li key={i}>{text.rule(rule)}</li>
          ))}
        </ul>
      )}

      {current.mode === 'own' && (
        <div className="flex flex-col gap-3 pl-[26px]">
          <label className="flex items-center gap-2 text-[12.5px]">
            <span className="text-muted-foreground">{t('startFrom')}</span>
            <select
              className={SELECT}
              value=""
              disabled={!canEdit}
              onChange={(e) => {
                const id = e.target.value as RecipePresetId;
                if (RECIPE_PRESET_IDS.includes(id)) edit({ rules: presetDraft(id) });
              }}
            >
              <option value="">{t('presetPlaceholder')}</option>
              {RECIPE_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`preset.${id}`)}
                </option>
              ))}
            </select>
          </label>

          <ol className="flex flex-col gap-2.5">
            {current.rules.map((rule, index) => (
              <RuleRow
                key={rule.id}
                index={index}
                rule={rule}
                canEdit={canEdit}
                onChange={editRule}
                onRemove={() => edit({ rules: current.rules.filter((r) => r.id !== rule.id) })}
              />
            ))}
          </ol>

          {canEdit && (
            <div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={current.rules.length >= MAX_RECIPE_RULES}
                onClick={() => edit({ rules: [...current.rules, newRule('output')] })}
              >
                <Plus className="size-4" />
                {t('addRule')}
              </Button>
            </div>
          )}

          {invalid && changed && (
            <p className="text-[11.5px] text-error-600 dark:text-error-400">
              {current.rules.length === 0 ? t('emptyOwn') : t('invalid')}
            </p>
          )}
        </div>
      )}

      {current.mode === 'none' && (
        <p className="pl-[26px] text-[12px] text-muted-foreground">{t('noneHint')}</p>
      )}

      <p className="text-[11.5px] text-muted-foreground">{t('neverBlocks')}</p>

      {canEdit && (
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={!changed || invalid || save.isPending}
            onClick={submit}
          >
            {t('save')}
          </Button>
        </div>
      )}
    </section>
  );
}

function RuleRow({
  index,
  rule,
  canEdit,
  onChange,
  onRemove,
}: {
  index: number;
  rule: DraftRule;
  canEdit: boolean;
  onChange: (next: DraftRule) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('Authoring.recipe.editor');
  const tr = useTranslations('Authoring');
  const text = useRecipeText();
  const parsed = fromDraft(rule);

  const valueLabel = (value: string) => {
    switch (rule.axis) {
      case 'input':
        return tr(`recipe.input.${value}` as 'recipe.input.text');
      case 'output':
        return tr(`recipe.output.${value}` as 'recipe.output.none');
      case 'modality':
        return tr(`coverage.modality.${value}` as 'coverage.modality.recognition');
      case 'skill':
        return tr(`coverage.skill.${value}` as 'coverage.skill.listening');
      case 'focus':
        return tr(`coverage.focus.${value}` as 'coverage.focus.grammar');
    }
  };

  return (
    <li
      aria-label={t('ruleLabel', { n: index + 1 })}
      className="flex flex-col gap-2 rounded-md border border-border bg-(--ssz-bg-base) p-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('axisLabel')}
          className={SELECT}
          value={rule.axis}
          disabled={!canEdit}
          onChange={(e) => onChange(setAxis(rule, e.target.value as RecipeAxis))}
        >
          {RECIPE_AXES.map((axis) => (
            <option key={axis} value={axis}>
              {tr(`recipe.axis.${axis}` as 'recipe.axis.input')}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-[12.5px]">
          <Checkbox
            checked={rule.negate}
            disabled={!canEdit}
            onCheckedChange={(checked) => onChange({ ...rule, negate: checked === true })}
          />
          {t('negate')}
        </label>

        <span className="flex-1" />

        {canEdit && (
          <button
            type="button"
            aria-label={t('removeRule', { n: index + 1 })}
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div role="group" aria-label={t('valuesLabel')} className="flex flex-wrap gap-x-3 gap-y-1.5">
        {RECIPE_VALUES[rule.axis].map((value) => (
          <label key={value} className="flex items-center gap-1.5 text-[12.5px]">
            <Checkbox
              checked={rule.values.includes(value)}
              disabled={!canEdit}
              onCheckedChange={() => onChange(toggleValue(rule, value))}
            />
            {valueLabel(value)}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[12.5px]">
        <select
          aria-label={t('boundLabel')}
          className={SELECT}
          value={rule.bound}
          disabled={!canEdit}
          onChange={(e) => onChange(setBound(rule, e.target.value as DraftBound))}
        >
          <option value="min">{t('bound.min')}</option>
          <option value="maxShare">{t('bound.maxShare')}</option>
        </select>
        <input
          type="number"
          inputMode="numeric"
          aria-label={t('amountLabel')}
          min={rule.bound === 'min' ? 1 : 0}
          max={rule.bound === 'min' ? undefined : 99}
          value={rule.n}
          disabled={!canEdit}
          onChange={(e) => onChange({ ...rule, n: e.target.value })}
          className={`${SELECT} w-20`}
        />
        <span className="text-muted-foreground">
          {rule.bound === 'min' ? t('unit.items') : t('unit.percent')}
        </span>
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        {parsed ? text.rule(parsed) : t('incomplete')}
      </p>
    </li>
  );
}
