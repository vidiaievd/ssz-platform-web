'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HATCH_WARN,
  Note,
  PA,
  SkillGrid,
  Stat,
  ZeroLegend,
  ramp,
  rampInk,
} from '@/features/analytics';
import type { LegendItem } from '@/features/analytics';
import { cellStateOf, type CellState } from '@/lib/shared-kernel/analytics';
import { FOCUSES, SKILLS } from '@/lib/shared-kernel/skills/model';

import { useContainerCoverage } from '../api/use-container-coverage';
import { useCourseResult } from '../api/use-course-result';
import { COVERAGE_FORMS, type CourseResult, type CoverageReport } from '../types';

/**
 * The subject axis, with the bucket an exercise lands in when nothing classified it.
 * Almost everything sits there today, and a grid without the column would look like a
 * course that teaches nothing rather than a catalogue that has not been annotated.
 */
const FOCUS_AXIS = [...FOCUSES, 'unknown'] as const;

interface Cell {
  state: CellState;
  items: number;
  attempts: number;
  ewma: number | null;
  learners: number;
  /** Evidence behind the cell, on the profile's scale — what `insufficient` is short of. */
  weightedSample: number;
  minWeightedSample: number;
}

/**
 * Screen E — what this course trains, against what came of teaching it.
 *
 * Two services answer one question here, and neither of them can answer it alone: content
 * knows how many exercises stand behind a `skill × focus` pair, analytics knows what
 * happened when people tried them. The point of putting them in one grid is the pair of
 * holes that only appears when both halves are present — a pair the course covers that
 * nobody has reached (a question for the timetable) against a pair it never teaches at
 * all (a question for the author) — and the two are the same blank cell on either screen
 * alone.
 *
 * **No learner appears here in any form**, including tooltips. The aggregate is over
 * everybody who took the course; a cell says how many people stand behind it precisely so
 * the reader can decline to read one person's profile as a verdict on the material.
 */
export function CoverageResultGrid({
  containerId,
  className,
}: {
  containerId: string;
  className?: string;
}) {
  const t = useTranslations('Analytics');
  const ta = useTranslations('Authoring.coverage');

  // The published version, not the draft the strip above draws: these results were
  // produced by the course learners actually have. Pairing them with the draft would
  // caption last night's edits with last month's attempts.
  const coverage = useContainerCoverage(containerId, 'published');
  const result = useCourseResult(containerId);

  const published: CoverageReport | null = coverage.data?.published ?? null;

  if (coverage.isLoading || result.isLoading) {
    return (
      <section className={className} aria-label={t('courseResult.title')}>
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  // Analytics down is not a course nobody took, and an unpublished course is not a course
  // of zeroes. Both say so in words rather than drawing an empty grid.
  if (result.isError) {
    return (
      <section className={className} aria-label={t('courseResult.title')}>
        <Note tone="warn" icon="warn">
          {t('unavailable')}
        </Note>
      </section>
    );
  }

  if (published === null || !published.available) {
    return (
      <section className={className} aria-label={t('courseResult.title')}>
        <Note>{t('courseResult.notPublished')}</Note>
      </section>
    );
  }

  const data = result.data;
  const cells = buildCells(published, data);
  const unreached = cells.filter((cell) => cell.state === 'notStarted').length;
  const notTaught = cells.filter((cell) => cell.state === 'noContent').length;
  const classified = published.coverage.total - published.coverage.unclassified;
  const soleLearnerCells = cells.filter((cell) => cell.learners === 1).length;

  const skill = (value: string) => ta(`skill.${value}` as 'skill.listening');
  const focus = (value: string) => ta(`focus.${value}` as 'focus.vocabulary');

  const legend: LegendItem[] = [
    { key: 'scale', label: t('courseResult.legend.scale') },
    { key: 'notStarted', label: t('courseResult.legend.unreached') },
    { key: 'noContent', label: t('courseResult.legend.notTaught') },
    { key: 'insufficient', label: t('state.insufficient') },
  ];

  return (
    <section className={className} aria-label={t('courseResult.title')}>
      <div className="space-y-5">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
              <Stat
                label={t('courseResult.summary.items')}
                value={String(published.coverage.total)}
              />
              <Stat
                label={t('courseResult.summary.classified')}
                value={String(classified)}
                sub={
                  published.coverage.unclassified === 0
                    ? undefined
                    : t('courseResult.summary.classifiedSub', {
                        count: published.coverage.unclassified,
                      })
                }
              />
              <Stat
                label={t('courseResult.summary.learners')}
                value={data === undefined ? '—' : String(data.learners)}
                sub={
                  data === undefined || data.groups === 0
                    ? t('courseResult.summary.learnersNoGroups')
                    : t('courseResult.summary.learnersSub', { count: data.groups })
                }
                tone="primary"
              />
              <Stat
                label={t('courseResult.summary.unreached')}
                value={String(unreached)}
                sub={t('courseResult.summary.unreachedSub')}
                tone={unreached > 0 ? 'warn' : 'neutral'}
              />
              <Stat
                label={t('courseResult.summary.notTaught')}
                value={String(notTaught)}
                sub={t('courseResult.summary.notTaughtSub')}
              />
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <Card>
            <CardBody className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-(--ssz-text-primary)">
                  {t('courseResult.grid.title')}
                </h3>
                <p className="text-xs text-(--ssz-text-secondary)">
                  {data === undefined
                    ? t('courseResult.grid.subtitleNoResult')
                    : t('courseResult.grid.subtitle', { threshold: data.minWeightedSample })}
                </p>
              </div>

              <SkillGrid
                skills={SKILLS}
                foci={FOCUS_AXIS}
                cell={(s, f) => cells.find((cell) => cell.skill === s && cell.focus === f)!}
                renderCell={(cell) => (
                  <ResultCell
                    cell={cell}
                    tip={tipOf(cell, t, skill(cell.skill), focus(cell.focus))}
                    labels={{
                      items: (count) => t('courseResult.cell.items', { count }),
                      unreached: t('courseResult.cell.unreached'),
                      notTaught: t('courseResult.cell.notTaught'),
                      shortfall: (sample, threshold) =>
                        t('courseResult.cell.shortfall', { sample, threshold }),
                    }}
                  />
                )}
                rowLabel={skill}
                colLabel={focus}
              />

              <ZeroLegend items={legend} compact />

              <Note>{t('courseResult.grid.privacy')}</Note>
              {soleLearnerCells > 0 && (
                <Note tone="warn">
                  {t('courseResult.grid.soleLearner', { count: soleLearnerCells })}
                </Note>
              )}
            </CardBody>
          </Card>

          <div className="space-y-5">
            <HoleCard
              title={t('courseResult.holes.schedule.title', { count: unreached })}
              body={t('courseResult.holes.schedule.body')}
              tone="warn"
            />
            <HoleCard
              title={t('courseResult.holes.content.title', { count: notTaught })}
              body={t('courseResult.holes.content.body')}
            />
            <ByForm report={published} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Every cell of the table, present whether anybody attempted it or not.
 *
 * The result endpoint lists only what was attempted, which is the right shape for it and
 * the wrong shape for a grid: the cells it omits are precisely the ones this screen was
 * built to show. `items` comes from coverage and never from analytics (plan 58 §2 C) — a
 * second source for "how many exercises" disagrees with the first after any publish.
 *
 * Where analytics could not be reached, the cells carry no attempts at all. That turns
 * every covered pair into "unreached", which would be a lie, so the caller draws the
 * failure instead of this table.
 */
function buildCells(
  published: CoverageReport,
  result: CourseResult | undefined,
): Array<Cell & { skill: string; focus: string }> {
  const minSample = result?.minWeightedSample ?? 0;

  return SKILLS.flatMap((skill) =>
    FOCUS_AXIS.map((focus) => {
      const items = published.coverage.byPair?.[skill]?.[focus] ?? 0;
      const measured = result?.cells.find((cell) => cell.skill === skill && cell.focus === focus);
      const attempts = measured?.attempts ?? 0;
      const ewma = measured?.ewma ?? null;

      return {
        skill,
        focus,
        items,
        attempts,
        ewma,
        learners: measured?.learners ?? 0,
        weightedSample: measured?.weightedSample ?? 0,
        minWeightedSample: minSample,
        state: cellStateOf({
          items,
          attempts,
          sample: measured?.weightedSample ?? 0,
          minSample,
          value: ewma === null ? null : ewma / 100,
        }),
      };
    }),
  );
}

interface ResultCellLabels {
  items: (count: number) => string;
  unreached: string;
  notTaught: string;
  shortfall: (sample: number, threshold: number) => string;
}

/**
 * One cell of screen E — the result on top, the material underneath.
 *
 * Three shapes, not three colours: filled for a measured pair, a dashed outline for a
 * pair the course covers and nobody has reached, and flat grey with a dash for one it
 * never teaches. In monochrome the three are still three.
 */
function ResultCell({ cell, labels, tip }: { cell: Cell; labels: ResultCellLabels; tip: string }) {
  const { style, primary, secondary } = paint(cell, labels);

  return (
    <div
      role="gridcell"
      title={tip}
      aria-label={tip}
      className="box-border grid h-[52px] place-items-center gap-px rounded-[9px] p-1 text-center"
      style={style}
    >
      {primary}
      {secondary}
    </div>
  );
}

function paint(
  cell: Cell,
  labels: ResultCellLabels,
): { style: CSSProperties; primary: ReactNode; secondary: ReactNode } {
  const under = (text: string, className = 'text-[9.5px] font-semibold opacity-85') => (
    <div className={className}>{text}</div>
  );

  switch (cell.state) {
    case 'noContent':
    case 'notDelivered':
    case 'unlinked':
      return {
        style: { background: 'var(--ssz-bg-subtle)', opacity: 0.6 },
        primary: <div className="text-sm font-bold text-(--ssz-text-muted)">—</div>,
        secondary: under(labels.notTaught, 'text-[9.5px] font-semibold text-(--ssz-text-muted)'),
      };

    case 'notStarted':
      // Covered and unreached: the material exists, so the number of items is the whole
      // content of the cell — it is what a teacher would be scheduling.
      return {
        style: {
          background: 'var(--ssz-bg-surface)',
          border: `1.5px dashed ${PA.primary}`,
          color: 'var(--ssz-text-secondary)',
        },
        primary: <div className="text-[13px] font-bold">{cell.items}</div>,
        secondary: under(labels.unreached, 'text-[9px] font-semibold'),
      };

    case 'insufficient':
      return {
        style: { background: HATCH_WARN, border: `1px solid ${PA.warnLine}`, color: PA.warnInk },
        primary: <div className="text-sm font-extrabold">?</div>,
        secondary: under(
          labels.shortfall(round(cell.weightedSample), cell.minWeightedSample),
          'text-[10px] font-bold',
        ),
      };

    default: {
      const value = cell.ewma ?? 0;
      return {
        style: { background: ramp(value), color: rampInk(value) },
        primary: <div className="text-[15px] font-extrabold tracking-[-0.02em]">{`${value}%`}</div>,
        secondary: under(labels.items(cell.items)),
      };
    }
  }
}

const round = (value: number): number => Math.round(value * 10) / 10;

type Translate = ReturnType<typeof useTranslations<'Analytics'>>;

/** The whole sentence a reader gets on hover, and the one a screen reader is read. */
function tipOf(
  cell: Cell & { skill: string; focus: string },
  t: Translate,
  skillLabel: string,
  focusLabel: string,
): string {
  const pair = `${skillLabel} × ${focusLabel}`;

  switch (cell.state) {
    case 'noContent':
    case 'notDelivered':
    case 'unlinked':
      return t('courseResult.tip.notTaught', { pair });
    case 'notStarted':
      return t('courseResult.tip.unreached', { pair, items: cell.items });
    case 'insufficient':
      return t('courseResult.tip.insufficient', { pair, items: cell.items });
    default:
      return t('courseResult.tip.measured', {
        pair,
        value: cell.ewma ?? 0,
        items: cell.items,
        learners: cell.learners,
      });
  }
}

function HoleCard({
  title,
  body,
  tone = 'neutral',
}: {
  title: string;
  body: string;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <Card>
      <CardBody className="space-y-1.5">
        <h4
          className="text-sm font-bold"
          style={{
            color: tone === 'warn' ? 'oklch(var(--ssz-secondary-ch))' : 'var(--ssz-text-primary)',
          }}
        >
          {title}
        </h4>
        <p className="text-xs leading-[1.55] text-(--ssz-text-secondary)">{body}</p>
      </CardBody>
    </Card>
  );
}

/**
 * Recognition against production, from the coverage report already loaded.
 *
 * The row that outranks the grid beside it in what it tells an author: a course can be
 * balanced across every channel and still be, most of it, picking an answer off a list.
 */
function ByForm({ report }: { report: CoverageReport }) {
  const t = useTranslations('Analytics');
  const ta = useTranslations('Authoring.coverage');
  const total = report.coverage.total;

  return (
    <Card>
      <CardBody className="space-y-2">
        <h4 className="text-sm font-bold text-(--ssz-text-primary)">
          {t('courseResult.form.title')}
        </h4>
        {COVERAGE_FORMS.map((form) => {
          const count = report.coverage.byForm[form];
          return (
            <div key={form} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-(--ssz-text-secondary)">
                  {ta(`form.${form}` as 'form.bank')}
                </span>
                <b className="tabular-nums text-(--ssz-text-primary)">{count}</b>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-subtle)">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: total === 0 ? '0%' : `${(count / total) * 100}%`,
                    background: PA.primary,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
