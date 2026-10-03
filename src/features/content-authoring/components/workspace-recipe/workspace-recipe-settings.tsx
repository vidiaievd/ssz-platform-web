'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Info } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { MAX_RECIPE_RULES } from '@/lib/shared-kernel/skills';

import { useWorkspaceCoverageRecipe } from '../../api/use-coverage-recipe';
import { matchPreset, toDrafts, type DraftRule } from '../../lib/recipe-draft';
import { RecipePresets } from './recipe-presets';
import { RecipeRuleCard } from './recipe-rule-card';

export type RecipeWorkspaceKind = 'school' | 'solo';

/**
 * The workspace's lesson recipe — plan 65, phase 2: what is saved, and who may change it.
 *
 * `recipe: null` (never set) and `{ rules: [] }` (set to ask for nothing) are different
 * states end to end: the first says nothing is checked yet, the second that the workspace
 * chose not to check.
 */
export function WorkspaceRecipeSettings({
  schoolId,
  canEdit,
  kind,
}: {
  schoolId: string;
  canEdit: boolean;
  kind: RecipeWorkspaceKind;
}) {
  const t = useTranslations('Settings.recipe');
  const format = useFormatter();
  const { data, isPending, isError } = useWorkspaceCoverageRecipe(schoolId);

  const saved: DraftRule[] | null = useMemo(
    () => (data?.recipe ? toDrafts(data.recipe) : null),
    [data],
  );

  if (isError) return <p className="text-[12.5px] text-(--ssz-text-muted)">{t('failed')}</p>;
  if (isPending || !data) return <RecipeSkeleton />;

  const savedAt = data.updatedAt
    ? format.dateTime(new Date(data.updatedAt), { dateStyle: 'medium' })
    : null;
  const rules = saved ?? [];

  return (
    <>
      {!canEdit && (
        <div className="flex gap-3 rounded-[10px] border border-(--ssz-color-info-100) bg-(--ssz-color-info-50) px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-(--ssz-color-info-700)" aria-hidden />
          <div>
            <p className="font-semibold">{t('readonly.title')}</p>
            <p className="text-(--ssz-text-secondary)">{t('readonly.who')}</p>
          </div>
        </div>
      )}

      <RecipeCard
        title={t('card.title')}
        meta={savedAt ? t('card.metaSaved', { date: savedAt }) : t('card.metaNever')}
      >
        {saved === null && <NeverSetCallout kind={kind} />}

        <section className="flex flex-col gap-3">
          <SectionHeader title={t('presets.title')} />
          <RecipePresets selected={matchPreset(rules)} edited={false} />
        </section>

        <hr className="-mx-4 border-(--ssz-border-default)" />

        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t('rules.title')}
            aside={
              <span
                className={
                  rules.length >= MAX_RECIPE_RULES
                    ? 'font-semibold text-(--ssz-color-warning-700)'
                    : undefined
                }
              >
                {t('rules.count', { n: rules.length, max: MAX_RECIPE_RULES })}
              </span>
            }
          />
          {rules.length === 0 ? (
            <EmptyRules never={saved === null} />
          ) : (
            <ol className="flex flex-col gap-3">
              {rules.map((rule, index) => (
                <RecipeRuleCard key={rule.id} rule={rule} number={index + 1} />
              ))}
            </ol>
          )}
        </section>
      </RecipeCard>

      {!canEdit && (
        <p className="text-xs text-(--ssz-text-muted)">
          {savedAt ? t('bar.readonly', { date: savedAt }) : t('bar.readonlyNever')}
        </p>
      )}
    </>
  );
}

export function RecipeCard({
  title,
  meta,
  sub,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-(--ssz-border-default) bg-(--ssz-bg-surface) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {meta && <span className="text-xs text-(--ssz-text-muted)">{meta}</span>}
      </div>
      {sub && <p className="-mt-2 text-xs text-(--ssz-text-secondary)">{sub}</p>}
      {children}
    </section>
  );
}

function SectionHeader({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[11px] font-bold tracking-[0.08em] text-(--ssz-text-secondary) uppercase">
        {title}
      </h3>
      {aside && <span className="text-xs text-(--ssz-text-muted) tabular-nums">{aside}</span>}
    </div>
  );
}

function NeverSetCallout({ kind }: { kind: RecipeWorkspaceKind }) {
  const t = useTranslations('Settings.recipe.never');
  return (
    <div className="flex gap-3 rounded-[10px] bg-(--ssz-bg-subtle) px-4 py-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)" aria-hidden />
      <div>
        <p className="font-semibold">{t('title', { kind })}</p>
        <p className="text-(--ssz-text-secondary)">{t('body')}</p>
      </div>
    </div>
  );
}

function EmptyRules({ never }: { never: boolean }) {
  const t = useTranslations('Settings.recipe.rules');
  const key = never ? 'emptyNever' : 'empty';
  return (
    <div className="rounded-[10px] border border-dashed border-(--ssz-border-strong) bg-(--ssz-bg-subtle) p-5">
      <p className="text-sm font-semibold">{t(`${key}.title`)}</p>
      <p className="mt-1 text-xs text-(--ssz-text-secondary)">{t(`${key}.body`)}</p>
    </div>
  );
}

function RecipeSkeleton() {
  const t = useTranslations('Settings.recipe');
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <div className="flex flex-col gap-4 rounded-[10px] border border-(--ssz-border-default) p-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="h-14" />
    </div>
  );
}
