'use client';

import { useMemo, useState } from 'react';
import { BookMarked, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useAtomCoverage } from '../api/use-atom-coverage';
import {
  MODALITIES,
  type AtomCoverage,
  type AtomCoverageEntry,
  type AtomCoverageIssue,
  type AtomCoverageSummary,
  type Modality,
} from '../types';

/**
 * Findings this report has wording for.
 *
 * The service's list is its own to grow: a finding shipped before this client learns its
 * sentence is dropped rather than rendered as a missing-translation crash — the rule the
 * coverage strip follows for remarks.
 */
const KNOWN_ISSUES = [
  'atom_untested',
  'atom_context_only',
  'atom_single_modality',
  'atom_unknown_modality',
  'rule_without_atoms',
  'scope_no_production',
  'scope_unaddressed_exercises',
] as const;

/** How many atoms a finding lists before it folds — a list that scrolls is a list nobody acts on. */
const NAMES_SHOWN = 8;

type Translate = ReturnType<typeof useTranslations<'Authoring.atomCoverage'>>;

function known(issue: AtomCoverageIssue): boolean {
  return (KNOWN_ISSUES as readonly string[]).includes(issue.code);
}

function Figure({
  label,
  value,
  tone = 'default',
  sub,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn' | 'muted';
  sub?: string;
}) {
  return (
    <div className="space-y-0.5">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <b
        className={cn(
          'block text-lg font-semibold tabular-nums leading-none',
          tone === 'warn' && 'text-destructive',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </b>
      {sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

/**
 * The modality row, every key printed.
 *
 * A zero here is the report's main product: "not one item in this lesson asks the learner
 * to produce anything" is the most useful sentence it can say, and it is indistinguishable
 * from a dropped key if the key is left out (plan 55 §3.10).
 */
function ModalityRow({ tally, t }: { tally: Record<Modality, number>; t: Translate }) {
  const peak = Math.max(...MODALITIES.map((modality) => tally[modality] ?? 0), 1);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {MODALITIES.map((modality) => {
        const count = tally[modality] ?? 0;
        return (
          <div key={modality} className="space-y-1">
            <div className="flex items-baseline justify-between gap-1.5">
              <span
                className={cn(
                  'truncate text-xs',
                  count === 0 ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {t(`modality.${modality}` as 'modality.recognition')}
              </span>
              <b
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  count === 0 ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {count}
              </b>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', count === 0 ? 'bg-transparent' : 'bg-primary')}
                style={{ width: `${(count / peak) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One finding, with the atoms it is about named rather than counted. */
function Finding({
  code,
  severity,
  names,
  t,
}: {
  code: string;
  severity: 'warning' | 'note';
  names: string[];
  t: Translate;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? names : names.slice(0, NAMES_SHOWN);
  const hidden = names.length - shown.length;

  return (
    <li className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'mt-1.5 inline-block size-1.5 shrink-0 rounded-full',
            severity === 'warning' ? 'bg-destructive' : 'bg-muted-foreground/50',
          )}
          aria-hidden
        />
        <span className="text-xs font-semibold text-foreground">
          {t(`issue.${code}` as 'issue.atom_untested', { count: names.length })}
        </span>
      </div>
      <p className="pl-3.5 text-xs leading-relaxed text-muted-foreground">
        {shown.join(', ')}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ml-1 underline underline-offset-2 hover:text-foreground"
          >
            {t('more', { count: hidden })}
          </button>
        )}
      </p>
    </li>
  );
}

/**
 * Findings, grouped by what they are.
 *
 * Twenty-seven separate "this word is never tested" lines are one finding about a lesson,
 * not twenty-seven findings, and printed one per row they bury everything else the report
 * has to say.
 */
function groupFindings(issues: AtomCoverageIssue[]): Array<{
  key: string;
  code: string;
  severity: 'warning' | 'note';
  names: string[];
}> {
  const groups = new Map<string, { code: string; severity: 'warning' | 'note'; names: string[] }>();

  for (const issue of issues) {
    if (!known(issue)) continue;
    // Said once, in the header, where it belongs — it is about the whole scope.
    if (issue.code === 'scope_unaddressed_exercises' || issue.code === 'scope_no_production') {
      continue;
    }
    // A single-modality finding says which modality, and "only ever recognised" and
    // "only ever produced" are not the same remark.
    const key = issue.modality ? `${issue.code}:${issue.modality}` : issue.code;
    const group = groups.get(key) ?? {
      code: issue.modality ? `${issue.code}_${issue.modality}` : issue.code,
      severity: issue.severity,
      names: [],
    };
    if (issue.title) group.names.push(issue.title);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...group }))
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'warning' ? -1 : 1;
      return b.names.length - a.names.length;
    });
}

function UnitRow({ scope, t }: { scope: AtomCoverage['units'][number]; t: Translate }) {
  const { summary } = scope;
  return (
    <tr className="border-t border-border">
      <td className="py-1.5 pr-3 text-xs text-foreground">{scope.title}</td>
      <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-muted-foreground">
        {summary.introduced}
      </td>
      <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-foreground">
        {summary.tested}
      </td>
      <td
        className={cn(
          'py-1.5 pr-3 text-right text-xs tabular-nums',
          summary.untested > 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {summary.untested}
      </td>
      <td
        className={cn(
          'py-1.5 pr-3 text-right text-xs tabular-nums',
          summary.byModality.production === 0 ? 'text-destructive' : 'text-foreground',
        )}
      >
        {summary.byModality.production}
      </td>
      <td className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
        {t('unitAddressed', {
          addressed: summary.exercisesAddressed,
          total: summary.exercises,
        })}
      </td>
    </tr>
  );
}

interface Props {
  /** The course or module to report on. A module is a container in its own right. */
  containerId: string;
  className?: string;
}

/**
 * What this course teaches, against what it ever asks — plan 63 §4.2.
 *
 * The coverage strip above it counts exercises by channel and subject; this counts the
 * facts themselves, so an author can be told that a lesson introduces twenty-four words,
 * six of which no exercise asks about, and that both its rules are only ever tested by
 * picking an answer off a list.
 *
 * How much of the catalogue carries an address at all is printed first and kept in view,
 * because it decides how everything under it should be read: six untested words out of
 * twenty-four means one thing when every exercise is addressed and nothing whatever when
 * ten of forty are. Without that line the report would read as an indictment of the
 * course when it is mostly a report on its markup.
 */
export function AtomCoverageReport({ containerId, className }: Props) {
  const t = useTranslations('Authoring.atomCoverage');
  const [showUnits, setShowUnits] = useState(false);
  const { data, isLoading, isError } = useAtomCoverage(containerId);

  const findings = useMemo(() => groupFindings(data?.issues ?? []), [data?.issues]);

  const summary: AtomCoverageSummary | null = data?.available ? data.summary : null;
  const unaddressed = summary ? summary.exercises - summary.exercisesAddressed : 0;

  return (
    <section className={cn('space-y-3', className)} aria-label={t('title')}>
      <div className="flex flex-wrap items-center gap-2">
        <BookMarked className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-bold tracking-wide text-muted-foreground">{t('title')}</span>
        {summary && (
          <span className="text-xs text-muted-foreground">
            {t('subtitle', { count: summary.introduced })}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="text-xs text-destructive">{t('loadError')}</p>
      ) : !data.available ? (
        <p className="text-xs text-muted-foreground">{t('noVersion')}</p>
      ) : summary && summary.introduced === 0 && summary.practisedElsewhere === 0 ? (
        // Not a report of zeroes: nothing here introduces a word or a rule yet, which is
        // a different statement from "this material tests nothing it teaches".
        <p className="text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        summary && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure
                label={t('figure.introduced')}
                value={summary.introduced}
                sub={t('figure.introducedSub', {
                  lexis: summary.introducedByTrack.lexis ?? 0,
                  grammar: summary.introducedByTrack.grammar ?? 0,
                })}
              />
              <Figure label={t('figure.tested')} value={summary.tested} />
              <Figure
                label={t('figure.untested')}
                value={summary.untested}
                tone={summary.untested > 0 ? 'warn' : 'default'}
              />
              <Figure
                label={t('figure.singleModality')}
                value={summary.singleModality}
                tone={summary.singleModality > 0 ? 'warn' : 'default'}
              />
            </div>

            {/* The line every finding below is read against, and never folded away. */}
            <p
              className={cn(
                'rounded-lg px-2.5 py-2 text-xs leading-relaxed',
                unaddressed > 0
                  ? 'bg-muted/60 text-foreground'
                  : 'bg-transparent text-muted-foreground',
              )}
            >
              {unaddressed > 0
                ? t('addressedWarning', {
                    addressed: summary.exercisesAddressed,
                    total: summary.exercises,
                  })
                : t('addressedAll', { total: summary.exercises })}
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t('modalityHeading')}
              </span>
              <ModalityRow tally={summary.byModality} t={t} />
              {summary.byModality.production === 0 && (
                <p className="text-xs text-destructive">{t('issue.scope_no_production')}</p>
              )}
            </div>

            {findings.length > 0 && (
              // The rules nobody has cut arrive as findings like everything else, and are
              // not drawn a second time from `rulesWithoutAtoms` — the two are the same
              // list, and printed both ways the report said everything twice.
              <ul className="space-y-2 border-t border-border pt-2.5">
                {findings.map((finding) => (
                  <Finding
                    key={finding.key}
                    code={finding.code}
                    severity={finding.severity}
                    names={finding.names}
                    t={t}
                  />
                ))}
              </ul>
            )}

            {data.units.length > 0 && (
              <div className="space-y-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnits((open) => !open)}
                  aria-expanded={showUnits}
                  className="flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  {showUnits ? (
                    <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <span>{t('units', { count: data.units.length })}</span>
                </button>

                {showUnits && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem]">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <th className="pb-1 pr-3 text-left font-bold">{t('column.unit')}</th>
                          <th className="pb-1 pr-3 text-right font-bold">
                            {t('column.introduced')}
                          </th>
                          <th className="pb-1 pr-3 text-right font-bold">{t('column.tested')}</th>
                          <th className="pb-1 pr-3 text-right font-bold">{t('column.untested')}</th>
                          <th className="pb-1 pr-3 text-right font-bold">
                            {t('column.production')}
                          </th>
                          <th className="pb-1 text-right font-bold">{t('column.addressed')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.units.map((unit) => (
                          <UnitRow key={unit.containerId} scope={unit} t={t} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Revision is not a gap, and saying so keeps the numbers above honest. */}
            {summary.practisedElsewhere > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {t('practisedElsewhere', { count: summary.practisedElsewhere })}
              </p>
            )}
          </>
        )
      )}
    </section>
  );
}

export type { AtomCoverageEntry };
