'use client';

import { useTranslations } from 'next-intl';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { RecipeIssue } from '../types';
import { useRecipeText } from '../hooks/use-recipe-text';

/**
 * What a lesson lacks against the course recipe — plan 64, decision P.
 *
 * A dot, never a lock: the lesson stays publishable, and the row says only that there is
 * something to read. What, and which types would close it, opens on demand — a lesson row
 * is one line, and fifty of them each spelling out their shortfall would be a wall.
 *
 * Amber whatever the rule, because the recipe is the author's own standard and missing it
 * is a note to self; red in this tree means something is broken.
 */
export function RecipeDot({ issues }: { issues: readonly RecipeIssue[] }) {
  const t = useTranslations('Authoring');
  const recipe = useRecipeText();
  if (issues.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('recipe.dot.label', { count: issues.length })}
          // The row underneath selects the module on click; reading the hint should not.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-full',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <span aria-hidden className="size-2 rounded-full bg-warning-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-[13px] font-bold text-foreground">{t('recipe.dot.title')}</p>
        <ul className="mt-2 space-y-2.5">
          {issues.map((issue) => (
            <li key={`${issue.code}:${issue.ruleIndex}`}>
              <p className="text-foreground">
                {issue.code === 'RECIPE_BELOW_MIN'
                  ? t('recipe.lesson.RECIPE_BELOW_MIN', {
                      count: issue.count,
                      min: issue.min,
                      rule: recipe.rule(issue.rule),
                    })
                  : t('recipe.lesson.RECIPE_ABOVE_SHARE', {
                      count: issue.count,
                      total: issue.total,
                      rule: recipe.rule(issue.rule),
                    })}
              </p>
              <p className="text-xs text-muted-foreground">{recipe.remedies(issue.rule)}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
