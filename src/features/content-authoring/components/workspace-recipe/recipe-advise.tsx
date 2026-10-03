'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRecipeText } from '../../hooks/use-recipe-text';
import { fromDraft, type DraftRule } from '../../lib/recipe-draft';
import { RecipeCard } from './recipe-card';
import { RulePhrase } from './recipe-rule-card';

/** How many live types a rule names before "+N more". */
const SHOWN = 5;

const CHIP =
  'inline-flex h-[22px] items-center rounded-[4px] border px-2 text-xs font-medium whitespace-nowrap';

/**
 * What the author of a lesson that misses each rule will be told — plan 65, BEHAVIOR §6.
 *
 * The types come from `remediesFor`, the same kernel judgement the tip on the amber dot
 * uses, never from a table written for this page: a type re-judged in `by-template.ts`
 * changes this advice and the dot's on the same day.
 */
export function RecipeAdvise({ rules }: { rules: readonly DraftRule[] }) {
  const t = useTranslations('Settings.recipe.advise');
  const tDot = useTranslations('Authoring.recipe.dot');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  return (
    <RecipeCard title={t('title')} sub={t('sub')}>
      <div
        aria-hidden
        className="inline-flex w-fit items-center gap-2 rounded-md border border-(--ssz-border-default) bg-(--ssz-bg-base) px-2.5 py-1.5 text-sm"
      >
        <span className="size-2 rounded-full bg-(--ssz-color-warning-500)" />
        <span className="font-mono text-xs text-(--ssz-text-muted)">1A</span>
        <span>{t('previewLesson')}</span>
        <span className="text-(--ssz-text-muted)">· {tDot('label', { count: 1 })}</span>
      </div>

      <ol className="flex flex-col">
        {rules.map((rule, index) => (
          <AdviseRow
            key={rule.id}
            rule={rule}
            number={index + 1}
            expanded={expanded.has(rule.id)}
            onExpand={() => setExpanded((prev) => new Set(prev).add(rule.id))}
          />
        ))}
      </ol>
    </RecipeCard>
  );
}

function AdviseRow({
  rule,
  number,
  expanded,
  onExpand,
}: {
  rule: DraftRule;
  number: number;
  expanded: boolean;
  onExpand: () => void;
}) {
  const t = useTranslations('Settings.recipe.advise');
  const text = useRecipeText();
  const parsed = fromDraft(rule);

  return (
    <li className="grid grid-cols-[28px_1fr] gap-x-3 gap-y-2 border-t border-(--ssz-border-default) py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-full border border-warning-100 bg-warning-50 text-[11px] font-bold text-warning-700 dark:border-warning-800 dark:bg-warning-900/40 dark:text-warning-300"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-semibold [&_span]:font-semibold">
          <span className="sr-only">{number}. </span>
          <RulePhrase rule={rule} />
        </p>
        <div className="text-xs text-(--ssz-text-secondary)">
          {parsed ? (
            <Remedies
              names={text.remedyNames(parsed)}
              ceiling={parsed.maxShare !== undefined}
              number={number}
              expanded={expanded}
              onExpand={onExpand}
            />
          ) : (
            t('fix', { n: number })
          )}
        </div>
      </div>
    </li>
  );
}

function Remedies({
  names,
  ceiling,
  number,
  expanded,
  onExpand,
}: {
  names: { live: string[]; planned: string[]; audioLayer: boolean };
  /** A ceiling is kept under by what it does not count; a floor closed by what it does. */
  ceiling: boolean;
  number: number;
  expanded: boolean;
  onExpand: () => void;
}) {
  const t = useTranslations('Settings.recipe.advise');
  const { live, planned, audioLayer } = names;

  if (live.length === 0 && planned.length === 0)
    return <p>{audioLayer ? t('recording') : t('none')}</p>;

  const shown = expanded ? live : live.slice(0, SHOWN);
  const hidden = live.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span>{ceiling ? t('keepsUnder') : t('closes')}</span>
      {shown.map((name) => (
        <span
          key={name}
          className={`${CHIP} border-(--ssz-border-default) bg-(--ssz-bg-subtle) text-(--ssz-text-primary)`}
        >
          {name}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={t('moreLabel', { count: hidden, n: number })}
          className="rounded-[4px] px-1 text-xs font-semibold text-(--ssz-text-accent) hover:underline focus-visible:ring-[3px] focus-visible:ring-(--ssz-border-focus)/30 focus-visible:outline-none"
        >
          {t('more', { count: hidden })}
        </button>
      )}
      {planned.map((name) => (
        <span key={name} className={`${CHIP} gap-1 border-dashed border-(--ssz-border-strong)`}>
          {name}
          <span className="text-[9px] font-bold tracking-[0.06em] text-info-700 dark:text-info-300 uppercase">
            {t('soon')}
          </span>
        </span>
      ))}
      {audioLayer && <span>{t('recording')}</span>}
    </div>
  );
}
