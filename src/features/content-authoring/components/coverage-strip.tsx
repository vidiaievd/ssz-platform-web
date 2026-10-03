'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Info, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useContainerCoverage } from '../api/use-container-coverage';
import {
  COVERAGE_FOCUSES,
  COVERAGE_MODALITIES,
  COVERAGE_SKILLS,
  type CoverageDifference,
  type CoverageIssue,
  type CoverageReport,
  type CoverageTallies,
} from '../types';

/**
 * Issue codes this strip has wording for.
 *
 * The kernel's list is closed today, but it is the kernel's to grow: a remark
 * shipped by the service before this client learns its sentence is dropped
 * rather than rendered as a missing-translation crash — an unknown remark
 * should be invisible, never fatal (the rule `ActivityBlock` follows for
 * actions).
 */
const KNOWN_ISSUES = [
  'COV_SKILL_ABSENT',
  'COV_SINGLE_SKILL',
  'COV_NO_FREE_PRODUCTION',
  'COV_MOSTLY_BANK',
  'COV_FOCUS_UNKNOWN',
  'COV_UNCLASSIFIED',
] as const;

function isKnownIssue(issue: CoverageIssue): boolean {
  return (KNOWN_ISSUES as readonly string[]).includes(issue.code);
}

interface Cell {
  key: string;
  label: string;
  count: number;
  /**
   * `notRecorded` is the "nobody said" bucket — the `unknown` cell of the
   * subject and answer axes. It is not a zero: a zero is a claim about the
   * material, and this is a claim about what was written down about it
   * (COVERAGE.md §1.2).
   */
  notRecorded?: boolean;
}

/**
 * One cell of an axis: its label, its number, and a bar that means something
 * only next to the other cells of the same row.
 *
 * Three states, told apart by shape and not by colour alone, because the report
 * is read in print and by people who do not see the difference between amber
 * and red:
 *  - nothing of this kind → red number and a dashed outline where the bar goes;
 *  - nobody recorded it → grey number and a hatched bar;
 *  - no material at all in the row → a flat cell with a dash, which is neither
 *    of the above and must not read as "you trained none of this".
 */
function AxisCell({
  cell,
  empty,
  peak,
  compact,
}: {
  cell: Cell;
  empty: boolean;
  peak: number;
  compact: boolean;
}) {
  const zero = cell.count === 0;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          compact ? 'flex flex-col gap-0.5' : 'flex items-baseline justify-between gap-1.5',
        )}
      >
        <span
          className={cn(
            'truncate',
            compact ? 'text-sm' : 'text-xs',
            zero && !compact ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {cell.label}
        </span>
        <b
          className={cn(
            'tabular-nums',
            compact ? 'text-2xl font-medium leading-none' : 'text-xs font-semibold',
            empty
              ? 'text-muted-foreground'
              : cell.notRecorded
                ? 'text-muted-foreground'
                : zero
                  ? 'text-error-700 dark:text-error-400'
                  : 'text-foreground',
          )}
        >
          {empty ? '–' : cell.count}
        </b>
      </div>

      {empty ? (
        <div className="h-1.5 rounded-full bg-muted/60" />
      ) : zero ? (
        <div className="h-1.5 rounded-full border border-dashed border-error-300" />
      ) : (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              cell.notRecorded ? 'bg-muted-foreground/40' : 'bg-primary',
            )}
            style={{
              width: `${(cell.count / peak) * 100}%`,
              // Hatched rather than tinted: "nobody recorded this" has to be
              // told from a real count without relying on colour. Struck out of
              // the surface colour, so it reads the same in both themes.
              backgroundImage: cell.notRecorded
                ? 'repeating-linear-gradient(45deg, transparent 0 3px, var(--color-card) 3px 6px)'
                : undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}

function AxisRow({ label, cells, compact }: { label: string; cells: Cell[]; compact: boolean }) {
  const t = useTranslations('Authoring.coverage');
  // The share is taken against the busiest cell, not against the total: rows are
  // read as "which of these dominates", and against a total that no row sums to
  // — an exercise can carry two skills — every bar would be a different fraction
  // of a different whole. Which is exactly why the caption says so.
  const highest = Math.max(...cells.map((cell) => cell.count), 0);
  const peak = Math.max(highest, 1);
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  const empty = highest === 0;

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex gap-x-3',
          compact ? 'flex-col gap-y-1' : 'flex-wrap items-baseline justify-between',
        )}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {!empty && (
          <span className={cn('text-[10px] text-muted-foreground', compact && 'font-mono')}>
            {t('barsCaption', { peak: highest, total })}
          </span>
        )}
      </div>
      <div className={cn('grid gap-x-4 gap-y-2', compact ? 'grid-cols-2' : 'grid-cols-4')}>
        {cells.map((cell) => (
          <AxisCell key={cell.key} cell={cell} empty={empty} peak={peak} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function IssueLine({ issue }: { issue: CoverageIssue }) {
  const t = useTranslations('Authoring.coverage');
  const Icon = issue.level === 'warning' ? AlertTriangle : Info;

  // Every parameter of every code, handed over at once: `next-intl` ignores the
  // ones a given message does not name, and enumerating per code here would be
  // the same table written six times.
  const values = {
    skill: 'skill' in issue ? t(`skill.${issue.skill}` as 'skill.listening') : '',
    total: 'total' in issue ? issue.total : 0,
    bank: 'bank' in issue ? issue.bank : 0,
    unknown: 'unknown' in issue ? issue.unknown : 0,
    count: 'count' in issue ? issue.count : 0,
  };

  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      <Icon
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          issue.level === 'warning'
            ? 'text-amber-600 dark:text-amber-500'
            : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <span className="text-muted-foreground">
        {t(`issue.${issue.code}` as 'issue.COV_SKILL_ABSENT', values)}
      </span>
    </li>
  );
}

function Tallies({
  report,
  compact,
}: {
  report: { coverage: CoverageTallies; issues: CoverageIssue[] };
  compact: boolean;
}) {
  const t = useTranslations('Authoring.coverage');
  const { coverage, issues } = report;

  const skillCells = COVERAGE_SKILLS.map((skill) => ({
    key: skill,
    label: t(`skill.${skill}` as 'skill.listening'),
    count: coverage.bySkill[skill],
  }));
  const focusCells = [...COVERAGE_FOCUSES, 'unknown' as const].map((focus) => ({
    key: focus,
    label: t(`focus.${focus}` as 'focus.vocabulary'),
    count: coverage.byFocus[focus],
    notRecorded: focus === 'unknown',
  }));
  // `modality`, not `form`: a bank of chunks to put in order and a bank of options to
  // pick from are the same `form`, and only one of them can be done without the rule
  // (plan 64, decision G).
  const answerCells = COVERAGE_MODALITIES.map((modality) => ({
    key: modality,
    label: t(`modality.${modality}` as 'modality.recognition'),
    count: coverage.byModality[modality],
    notRecorded: modality === 'unknown',
  }));

  // `COV_SKILL_ABSENT` is dropped, not rendered: the line above already names every
  // channel nothing trains, and the remark repeats it one channel per line. The rule
  // itself stays in the kernel — this is a filter over its output (§1.7), not a second
  // opinion about when a channel counts as absent.
  const known = issues.filter((issue) => isKnownIssue(issue) && issue.code !== 'COV_SKILL_ABSENT');

  return (
    <div className={compact ? 'space-y-5' : 'space-y-3'}>
      <AxisRow label={t('axis.skill')} cells={skillCells} compact={compact} />
      <AxisRow label={t('axis.focus')} cells={focusCells} compact={compact} />
      {/* Last and least prominent by position, first in what it tells an author:
          a course can be balanced across all four channels and still be, 84% of
          it, picking an answer off a list (§3.7). */}
      <AxisRow label={t('axis.form')} cells={answerCells} compact={compact} />

      {coverage.emptySkills.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('emptySkills', {
            skills: coverage.emptySkills
              .map((skill) => t(`skill.${skill}` as 'skill.listening'))
              .join(', '),
          })}
        </p>
      )}

      {known.length > 0 && (
        <ul className="space-y-1">
          {known.map((issue) => (
            <IssueLine key={`${issue.code}-${'skill' in issue ? issue.skill : ''}`} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** "listening 0 against 6" — the cells, named, in the order the service listed them. */
function useDifferenceSummary(differences: CoverageDifference[]): string {
  const t = useTranslations('Authoring.coverage');

  return differences
    .slice(0, 3)
    .map((difference) =>
      t('differenceCell', {
        cell: t(`${difference.axis}.${difference.key}` as 'skill.listening'),
        draft: difference.draft,
        published: difference.published,
      }),
    )
    .join(', ');
}

interface CoverageStripProps {
  /** The course or module to count. A module is a container in its own right. */
  containerId: string;
  /** Two columns per row instead of four — the inspector is a narrow pane. */
  compact?: boolean;
  /**
   * Drops the strip's own heading, for a caller that has already said what is
   * being counted and in what unit. Two headings one above the other would read
   * as two reports.
   */
  hideHeading?: boolean;
  className?: string;
}

/**
 * What this course or module actually trains, and what it never touches.
 *
 * Draws the draft, because the draft is what the author is editing (Q5). The
 * published version appears only when it disagrees, as one line that unfolds
 * into a second strip: two identical strips side by side, every day of the
 * week, would teach an author to read neither.
 *
 * Nothing here re-derives a rule. The skills, the tallies and the remarks are
 * the service's answer, and this is a renderer over it (§1.7) — the alternative
 * is the same rule written twice, drifting apart at the first change.
 */
export function CoverageStrip({
  containerId,
  compact = false,
  hideHeading = false,
  className,
}: CoverageStripProps) {
  const t = useTranslations('Authoring.coverage');
  const [showPublished, setShowPublished] = useState(false);
  const { data, isLoading, isError } = useContainerCoverage(containerId);

  const draft: CoverageReport | null = data?.draft ?? null;
  const summary = useDifferenceSummary(data?.differences ?? []);

  return (
    <section className={cn('space-y-3', className)} aria-label={t('title')}>
      <div className={cn('flex items-center gap-2', hideHeading && 'sr-only')}>
        <Target className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-bold tracking-wide text-muted-foreground">{t('title')}</span>
        {draft && draft.coverage.total > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('total', { count: draft.coverage.total })}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : isError || !draft ? (
        <p className="text-xs text-destructive">{t('loadError')}</p>
      ) : draft.coverage.total === 0 ? (
        // Not a strip of zeroes: nothing has been placed here yet, which is a
        // different statement from "none of this material trains listening".
        <p className="text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <Tallies report={draft} compact={compact} />

          {data?.diverges && data.published?.available && (
            <div className="space-y-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setShowPublished((open) => !open)}
                aria-expanded={showPublished}
                className="flex w-full items-start gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                {showPublished ? (
                  <ChevronDown className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                <span>{t('diverges', { cells: summary })}</span>
              </button>

              {showPublished && (
                <div className="space-y-2 rounded-lg bg-muted/40 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t('publishedLabel')}
                  </span>
                  <Tallies report={data.published} compact={compact} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
