'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { RecipeRule } from '../types';
import { remediesFor } from '../lib/recipe-remedies';

/** How many types a hint names before the rest would be noise. */
const NAMED = 4;

/**
 * A recipe rule and its cure, in words.
 *
 * The rule arrives as data — an axis, values, a bound — because the kernel and the four
 * locales cannot share prose (plan 53 §3.6). The channel, subject and modality names are
 * the coverage report's own, so a rule says "Listening" exactly where the bars say it.
 */
export function useRecipeText() {
  const t = useTranslations('Authoring');
  const locale = useLocale();
  const or = new Intl.ListFormat(locale, { type: 'disjunction' });
  const and = new Intl.ListFormat(locale, { type: 'conjunction' });

  function valueLabel(axis: RecipeRule['axis'], value: string): string {
    switch (axis) {
      case 'input':
        return t(`recipe.input.${value}` as 'recipe.input.text');
      case 'output':
        return t(`recipe.output.${value}` as 'recipe.output.none');
      case 'modality':
        return t(`coverage.modality.${value}` as 'coverage.modality.recognition');
      case 'skill':
        return t(`coverage.skill.${value}` as 'coverage.skill.listening');
      case 'focus':
        return t(`coverage.focus.${value}` as 'coverage.focus.grammar');
    }
  }

  /** "at least 1 item — Answer: not None". */
  function rule(r: RecipeRule): string {
    const values = or.format(r.values.map((value) => valueLabel(r.axis, value)));
    const target = t(r.negate ? 'recipe.target.not' : 'recipe.target.is', {
      axis: t(`recipe.axis.${r.axis}` as 'recipe.axis.input'),
      values,
    });
    return r.min !== undefined
      ? t('recipe.rule.min', { min: r.min, target })
      : t('recipe.rule.maxShare', { share: Math.round((r.maxShare ?? 0) * 100), target });
  }

  /** "Closes it: Short answer, Writing task, Dictation (soon)". */
  function remedies(r: RecipeRule): string {
    const { live, planned, audioLayer } = remediesFor(r);
    const names = [
      ...live.map((type) =>
        t(`exercises.types.${type.labelKey}` as 'exercises.types.short_answer'),
      ),
      ...planned.map((type) =>
        t('recipe.remedy.soon', {
          type: t(`exercises.types.${type.labelKey}` as 'exercises.types.dictation'),
        }),
      ),
    ];
    const shown = names.slice(0, NAMED);
    if (names.length > NAMED) shown.push(t('recipe.remedy.more', { count: names.length - NAMED }));

    if (shown.length === 0)
      return audioLayer ? t('recipe.remedy.audioOnly') : t('recipe.remedy.none');
    const types = and.format(shown);
    return audioLayer
      ? t('recipe.remedy.typesOrAudio', { types })
      : t('recipe.remedy.types', { types });
  }

  return { rule, remedies };
}
