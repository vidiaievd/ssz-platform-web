'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { wsHref } from '@/features/workspaces/lib/href';

import { useWorkspaceRecipeCourses } from '../../api/use-coverage-recipe';
import { RecipeCard } from './recipe-card';
import type { RecipeWorkspaceKind } from './workspace-recipe-settings';

/**
 * How the workspace's courses use the recipe — plan 65, BEHAVIOR §7.
 *
 * Optional by design: drawn only when the counts have arrived and there is a course to
 * count. Each course that differs links to its settings drawer, where the choice is made.
 */
export function RecipeCourses({
  schoolId,
  kind,
  neverSet,
}: {
  schoolId: string;
  kind: RecipeWorkspaceKind;
  /** No workspace recipe saved: one line instead of three zeros' worth of meaning. */
  neverSet: boolean;
}) {
  const t = useTranslations('Settings.recipe.courses');
  const { data } = useWorkspaceRecipeCourses(schoolId);
  if (!data || data.total === 0) return null;

  return (
    <RecipeCard title={t('title')} sub={t('sub', { kind, n: data.total })}>
      {neverSet ? (
        <p className="text-sm text-(--ssz-text-secondary)">{t('never', { n: data.total })}</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            {(
              [
                ['follow', data.follow],
                ['own', data.own],
                ['none', data.none],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="rounded-md bg-(--ssz-bg-subtle) p-3">
                <dd className="text-base font-bold tabular-nums sm:text-xl">{value}</dd>
                <dt className="text-xs text-(--ssz-text-secondary)">
                  {key === 'follow' ? t('follow', { kind }) : t(key)}
                </dt>
              </div>
            ))}
          </dl>

          {data.exceptions.length > 0 && (
            <section className="flex flex-col">
              <h3 className="mb-1 text-[11px] font-bold tracking-[0.08em] text-(--ssz-text-secondary) uppercase">
                {t('differ')}
              </h3>
              <ul>
                {data.exceptions.map((course) => (
                  <li
                    key={course.courseId}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-t border-(--ssz-border-default) py-2"
                  >
                    <Link
                      href={`${wsHref(schoolId, `content/${course.courseId}`)}?settings=1`}
                      className="text-sm font-semibold text-(--ssz-color-primary-700) hover:underline"
                    >
                      {course.title}
                    </Link>
                    <span className="text-xs text-(--ssz-text-muted)">
                      {course.mode === 'own'
                        ? t('modeOwn', { count: course.ruleCount })
                        : t('modeNone')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </RecipeCard>
  );
}
