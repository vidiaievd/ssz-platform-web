'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { useAtomCoverage } from '../api/use-atom-coverage';
import { useContainerCoverage } from '../api/use-container-coverage';
import { buildTriage, type TriageRow, type TriageTarget } from '../lib/coverage-triage';
import { useRecipeText } from '../hooks/use-recipe-text';

/** How many findings are shown before the rest fold behind a button. */
const SHOWN = 3;

function targetHref(pathname: string, target: TriageTarget): string {
  const params = new URLSearchParams({ view: 'structure', type: target.type });
  if (target.state) params.set('state', target.state);
  return `${pathname}?${params.toString()}`;
}

function Row({ row, pathname }: { row: TriageRow; pathname: string }) {
  const t = useTranslations('Authoring');
  const recipe = useRecipeText();
  const text =
    row.source === 'recipe' && row.rule
      ? t(`recipe.issue.${row.code}` as 'recipe.issue.RECIPE_BELOW_MIN', {
          ...row.values,
          rule: recipe.rule(row.rule),
        })
      : row.source === 'skill'
        ? t(`coverage.issue.${row.code}` as 'coverage.issue.COV_SKILL_ABSENT', row.values)
        : t(`atomCoverage.issue.${row.code}` as 'atomCoverage.issue.atom_untested', row.values);
  // A recipe row's second line is the cure, not the reason: the author chose the rule,
  // and telling them why it matters would be telling them their own method.
  const sub =
    row.source === 'recipe' && row.rule
      ? recipe.remedies(row.rule)
      : t(`triage.sub.${row.code}` as 'triage.sub.atom_untested');

  return (
    <li className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          row.severity === 'high'
            ? 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300'
            : 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        )}
      >
        {row.severity === 'high' ? '!' : '·'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{text}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>

      {row.target && (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={targetHref(pathname, row.target)}>
            {t(`triage.action.${row.target.type}` as 'triage.action.exercises')}
          </Link>
        </Button>
      )}
    </li>
  );
}

/**
 * What to do about this course, before anything about what it is.
 *
 * The report says nine true things at once, and an author shown nine findings
 * acts on none of them. Three are on screen; the rest are one click away, and
 * every button lands in the tree already filtered to the material the finding
 * is about — a finding you have to go and look for yourself is a finding you
 * read and forget.
 *
 * The notes underneath are the findings about the record rather than about the
 * material: an exercise nobody classified is not a gap in the course, it is a
 * gap in what the report can see, and treating it as a task would send authors
 * hunting for a problem that is not there.
 */
export function CoverageTriage({ containerId }: { containerId: string }) {
  const t = useTranslations('Authoring');
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const { data: coverage } = useContainerCoverage(containerId);
  const { data: atoms } = useAtomCoverage(containerId);

  const { rows, notes } = buildTriage(coverage, atoms, (skill) =>
    t(`coverage.skill.${skill}` as 'coverage.skill.listening'),
  );

  if (rows.length === 0 && notes.length === 0) return null;

  const visible = expanded ? rows : rows.slice(0, SHOWN);

  return (
    <section aria-label={t('triage.title')} className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-[13px] font-bold text-foreground">{t('triage.title')}</h2>

      <ul className="mt-1">
        {visible.map((row) => (
          <Row key={row.key} row={row} pathname={pathname} />
        ))}
      </ul>

      {rows.length > SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          {expanded ? t('triage.showLess') : t('triage.showMore', { count: rows.length - SHOWN })}
        </button>
      )}

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {notes.map((note) => (
            <li key={note.key} className="text-xs text-muted-foreground">
              {note.source === 'skill'
                ? t(`coverage.issue.${note.code}` as 'coverage.issue.COV_UNCLASSIFIED', note.values)
                : t(
                    `atomCoverage.issue.${note.code}` as 'atomCoverage.issue.atom_unknown_modality',
                    note.values,
                  )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
