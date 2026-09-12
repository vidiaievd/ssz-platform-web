'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';

import {
  DeliveredAbsorbed,
  Heatmap,
  Note,
  PaDefs,
  Stat,
  ZeroLegend,
  useHeatmapSort,
  type ChartAbsorbed,
  type ChartDelivered,
  type HeatmapUnit,
  type LegendItem,
} from '@/features/analytics';
import {
  pictureOf,
  type GroupProgress,
  type GroupProgressUnit,
  type HeatmapRow,
} from '@/features/analytics/types';
import { isMeasured } from '@/lib/shared-kernel/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';

import { useGroupHeatmap } from '../api/use-group-heatmap';
import { useGroupProgress } from '../api/use-group-progress';

type View = 'all' | 'context';

/** A projection older than this is worth saying out loud in the footer. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function GroupProgressTab({
  schoolId,
  groupId,
  schoolSlug,
  canSeePersonalResults,
}: {
  schoolId: string;
  groupId: string;
  schoolSlug: string;
  /** False for a scheduler: the heatmap carries named results and they have no use for them. */
  canSeePersonalResults: boolean;
}) {
  const t = useTranslations('Analytics');
  const { data, isPending, isError } = useGroupProgress(schoolId, groupId);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  // Analytics being unreachable empties this tab and says so. It must never be drawn as
  // a group with nothing in it — that is a claim about the group, not about the service.
  if (isError || !data) {
    return (
      <Note tone="warn" icon="warn">
        {t('unavailable')}
      </Note>
    );
  }

  return (
    <Progress
      data={data}
      schoolId={schoolId}
      schoolSlug={schoolSlug}
      groupId={groupId}
      canSeePersonalResults={canSeePersonalResults}
    />
  );
}

function Progress({
  data,
  schoolId,
  schoolSlug,
  groupId,
  canSeePersonalResults,
}: {
  data: GroupProgress;
  schoolId: string;
  schoolSlug: string;
  groupId: string;
  canSeePersonalResults: boolean;
}) {
  const t = useTranslations('Analytics');
  const format = useFormatter();
  const [view, setView] = useState<View>('all');
  const [picked, setPicked] = useState<number | null>(null);
  // Read once, on mount, and passed to every relative time on the screen. Two reasons:
  // the footer says whether the projection is behind, and a clock that moved between
  // renders would make the one sentence about trustworthiness the least stable thing
  // here; and next-intl wants an explicit `now` rather than falling back to the ambient
  // clock, which differs between the server render and the browser's.
  const [now] = useState(() => Date.now());

  const picture = pictureOf(data);
  const groupHref = `/school/${schoolSlug}/groups/${groupId}`;

  if (picture === 'noCourse') {
    return (
      <Empty
        title={t('empty.noCourse.title')}
        body={t('empty.noCourse.body')}
        actionLabel={t('empty.noCourse.action')}
        href={groupHref}
      />
    );
  }

  const delivered: ChartDelivered[] = data.units.map((unit) => ({
    value: unit.delivered?.value ?? null,
  }));
  const absorbed: ChartAbsorbed[] = data.units.map((unit) => ({
    state: unit.state,
    median: unit.absorbed?.median ?? null,
    p25: unit.absorbed?.p25 ?? null,
    p75: unit.absorbed?.p75 ?? null,
  }));
  const quality = Object.fromEntries(data.units.map((unit) => [unit.unitId, unit.quality]));

  const legend: LegendItem[] = [
    { key: 'scale', label: t('legend.scale') },
    { key: 'notStarted', label: t('state.notStarted') },
    { key: 'insufficient', label: t('state.insufficient') },
    { key: 'notDelivered', label: t('state.notDelivered') },
    { key: 'unlinked', label: t('state.unlinked') },
  ];

  const stale = now - new Date(data.updatedAt).getTime() > STALE_AFTER_MS;

  return (
    <div className="space-y-4">
      <PaDefs />

      <Card>
        <CardBody>
          {/* One column on a phone, two in between, five when there is room: the summary
              must be readable in full at every width — §2 of the brief. */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label={t('summary.delivered')}
              value={`${data.summary.deliveredUnits}/${data.summary.plannedUnits}`}
              sub={t('summary.deliveredSub', {
                held: data.summary.lessonsHeld,
                planned: data.summary.lessonsPlanned,
              })}
            />
            <Stat
              label={t('summary.absorbed')}
              value={data.summary.absorbedMedian === null ? '—' : `${data.summary.absorbedMedian}%`}
              sub={t('summary.absorbedSub')}
              tone="primary"
            />
            <Stat
              label={t('summary.belowLine')}
              value={String(data.summary.belowLine)}
              sub={data.summary.belowLineRule}
              tone={data.summary.belowLine > 0 ? 'warn' : 'neutral'}
            />
            <Stat
              label={t('summary.notJudgeable')}
              value={String(data.summary.notJudgeable)}
              sub={t('summary.notJudgeableSub', { threshold: data.minWeightedSample })}
              hint={t('summary.notJudgeableHint', { threshold: data.minWeightedSample })}
            />
            <Stat
              label={t('summary.lastActivity')}
              value={
                data.summary.lastActivityAt === null
                  ? '—'
                  : format.relativeTime(new Date(data.summary.lastActivityAt), now)
              }
            />
          </div>
        </CardBody>
      </Card>

      {picture === 'noLessons' ? (
        <Empty
          title={t('empty.noLessons.title')}
          body={t('empty.noLessons.body')}
          actionLabel={t('empty.noLessons.action')}
          href={`${groupHref}?tab=schedule`}
        />
      ) : (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-(--ssz-text-primary)">{t('chart.title')}</h3>
              <Segmented
                size="sm"
                options={[
                  { value: 'all', label: t('chart.viewAll') },
                  { value: 'context', label: t('chart.viewContext') },
                ]}
                value={view}
                onValueChange={(next) => setView(next as View)}
                aria-label={t('chart.viewLabel')}
              />
            </div>

            {picture === 'noAttempts' && (
              <Note>{t('empty.noAttempts.body', { units: data.summary.deliveredUnits })}</Note>
            )}

            {view === 'all' ? (
              <>
                {/* A phone cannot hold the chart; the summary above it already read in
                    full, so the chart folds away rather than shrinking into noise. The
                    caption and the legend fold with it — a legend for a picture nobody
                    can see explains nothing. */}
                <details className="space-y-3 sm:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-(--ssz-text-secondary)">
                    {t('chart.show')}
                  </summary>
                  <Chart
                    data={data}
                    delivered={delivered}
                    absorbed={absorbed}
                    quality={quality}
                    picked={picked}
                    onPick={setPicked}
                    height={240}
                  />
                  <ChartKey legend={legend} label={t('chart.qualityStrip')} />
                </details>
                <div className="hidden space-y-3 sm:block">
                  <Chart
                    data={data}
                    delivered={delivered}
                    absorbed={absorbed}
                    quality={quality}
                    picked={picked}
                    onPick={setPicked}
                  />
                  <ChartKey legend={legend} label={t('chart.qualityStrip')} />
                </div>
                {picked !== null && data.units[picked] ? (
                  <UnitPanel unit={data.units[picked]} minSample={data.minWeightedSample} />
                ) : null}
                {data.deliveryUnavailable && (
                  <Note tone="warn" icon="warn">
                    {t('chart.noTimetable')}
                  </Note>
                )}
              </>
            ) : (
              <WorkContext data={data} />
            )}
          </CardBody>
        </Card>
      )}

      {canSeePersonalResults && picture !== 'noLessons' && (
        <HeatmapPanel
          schoolId={schoolId}
          schoolSlug={schoolSlug}
          groupId={groupId}
          legend={legend}
        />
      )}

      {data.unlinkedPlanUnits.length > 0 && (
        <UnlinkedBlock data={data} href={`${groupHref}?tab=schedule`} />
      )}

      <p className="text-xs text-(--ssz-text-muted)">
        {t('footer.updated', { when: format.relativeTime(new Date(data.updatedAt), now) })}
        {stale ? ` — ${t('footer.behind')}` : ''}
      </p>
    </div>
  );
}

/** The caption for the quality strip and the legend of the five kinds of zero. */
function ChartKey({ legend, label }: { legend: LegendItem[]; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[10.5px] font-semibold text-(--ssz-text-muted)">{label}</p>
      <ZeroLegend items={legend} compact />
    </div>
  );
}

function Chart({
  data,
  delivered,
  absorbed,
  quality,
  picked,
  onPick,
  height,
}: {
  data: GroupProgress;
  delivered: ChartDelivered[];
  absorbed: ChartAbsorbed[];
  quality: Record<string, number | null>;
  picked: number | null;
  onPick: (index: number | null) => void;
  height?: number;
}) {
  return (
    <DeliveredAbsorbed
      units={data.units}
      delivered={delivered}
      absorbed={absorbed}
      quality={quality}
      picked={picked}
      height={height}
      // Clicking the same column again clears it: the panel is a detail of a choice,
      // and there has to be a way back to no choice at all.
      onPick={(index) => onPick(picked === index ? null : index)}
    />
  );
}

/** The row under the chart — why this unit has the number it has, or why it has none. */
function UnitPanel({ unit, minSample }: { unit: GroupProgressUnit; minSample: number }) {
  const t = useTranslations('Analytics');

  const reason = () => {
    switch (unit.state) {
      case 'unlinked':
        return t('unit.unlinked');
      case 'notDelivered':
        return t('unit.notDelivered');
      case 'insufficient':
        return t('unit.insufficient', { learners: unit.absorbed?.n ?? 0, threshold: minSample });
      case 'noContent':
        return t('unit.noContent');
      case 'notStarted':
        return t('unit.notStarted');
      default:
        return null;
    }
  };

  const measured = isMeasured(unit.state) && unit.absorbed !== null;

  return (
    <div className="rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-subtle) px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-bold text-(--ssz-text-primary)">
          {unit.no}. {unit.title}
        </span>
        <span className="text-xs text-(--ssz-text-secondary)">
          {t('unit.lessons', { count: unit.delivered?.lessons ?? 0 })}
        </span>
        {measured && unit.absorbed ? (
          <span className="text-xs text-(--ssz-text-secondary)">
            {t('unit.spread', {
              median: unit.absorbed.median,
              p25: unit.absorbed.p25,
              p75: unit.absorbed.p75,
              n: unit.absorbed.n,
            })}
          </span>
        ) : null}
      </div>
      {reason() ? (
        <p className="mt-1 text-xs leading-snug text-(--ssz-text-secondary)">{reason()}</p>
      ) : null}
    </div>
  );
}

/** Four bars: where the work was done. `Not recorded` is hatched, not coloured. */
function WorkContext({ data }: { data: GroupProgress }) {
  const t = useTranslations('Analytics');
  const format = useFormatter();

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {data.workContext.map((bucket) => {
          const key = bucket.key ?? 'unsaid';
          return (
            <li key={key} className="grid grid-cols-[130px_1fr_auto] items-center gap-3">
              <span className="text-xs font-semibold text-(--ssz-text-secondary)">
                {t(`context.${key}` as 'context.homework')}
              </span>
              <ContextBar bucket={bucket} />
              <span className="text-xs text-(--ssz-text-muted) tabular-nums">
                {t('context.attempts', { count: bucket.attempts })}
              </span>
            </li>
          );
        })}
      </ul>

      <Note>
        {t('context.note', {
          from: format.dateTime(new Date(data.workContextSplitFrom), { dateStyle: 'medium' }),
        })}
        {data.workContextUnattributed > 0
          ? ` ${t('context.unattributed', { count: data.workContextUnattributed })}`
          : ''}
      </Note>
    </div>
  );
}

function ContextBar({ bucket }: { bucket: GroupProgress['workContext'][number] }) {
  // `Not recorded` is drawn as hatching rather than in a bucket's colour: it is not a
  // way of working, it is the absence of a record, and colouring it would make it one.
  const unsaid = bucket.key === null;

  return (
    <div className="h-3 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(bucket.share, bucket.attempts > 0 ? 2 : 0)}%`,
          background: unsaid
            ? 'repeating-linear-gradient(45deg, var(--ssz-bg-subtle) 0 4px, var(--ssz-border-default) 4px 6px)'
            : 'oklch(var(--ssz-primary-ch))',
        }}
      />
    </div>
  );
}

/**
 * Plan units taught against nothing — always shown, never collapsed (§O3).
 *
 * These are lessons that really happened and cannot be counted anywhere, so hiding the
 * block when it is inconvenient would hide the one thing a teacher can actually fix.
 */
function UnlinkedBlock({ data, href }: { data: GroupProgress; href: string }) {
  const t = useTranslations('Analytics');
  const format = useFormatter();

  return (
    <div className="rounded-2xl border-2 border-dashed border-(--ssz-border-strong) p-4">
      <h3 className="text-sm font-bold text-(--ssz-text-primary)">
        {t('unlinked.title', { count: data.unlinkedPlanUnits.length })}
      </h3>
      <p className="mt-1 text-xs text-(--ssz-text-secondary)">{t('unlinked.body')}</p>
      <ul className="mt-3 space-y-2">
        {data.unlinkedPlanUnits.map((unit) => (
          <li
            key={unit.curriculumUnitId}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm text-(--ssz-text-primary)">{unit.title}</span>
            <span className="text-xs text-(--ssz-text-muted)">
              {t('unit.lessons', { count: unit.lessons })}
              {unit.lastHeldAt
                ? ` · ${format.dateTime(new Date(unit.lastHeldAt), { dateStyle: 'medium' })}`
                : ''}
            </span>
            <Button asChild size="sm" variant="outline">
              <a href={href}>{t('unlinked.action')}</a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({
  title,
  body,
  actionLabel,
  href,
}: {
  title: string;
  body: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <Card>
      <CardBody className="space-y-2 text-center">
        <h3 className="text-base font-bold text-(--ssz-text-primary)">{title}</h3>
        <p className="text-sm text-(--ssz-text-secondary)">{body}</p>
        <div className="pt-1">
          <Button asChild size="sm">
            <a href={href}>{actionLabel}</a>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * The map of every learner against every unit, under the chart it explains.
 *
 * Its own query and its own failure: a role that may not read named results is refused
 * this route outright, and that refusal must empty this panel rather than the chart
 * above it. Folded away on a phone for the same reason the chart is — the summary has
 * already been read in full by then.
 */
function HeatmapPanel({
  schoolId,
  schoolSlug,
  groupId,
  legend,
}: {
  schoolId: string;
  schoolSlug: string;
  groupId: string;
  legend: LegendItem[];
}) {
  const t = useTranslations('Analytics');
  const format = useFormatter();
  const [sort, setSort] = useHeatmapSort('roster');
  const { data, isPending, isError } = useGroupHeatmap(schoolId, groupId);

  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (isError || !data) {
    return (
      <Card>
        <CardBody>
          <Note tone="warn" icon="warn">
            {t('heatmap.unavailable')}
          </Note>
        </CardBody>
      </Card>
    );
  }

  /** The whole sentence, so a reader is never left to decode a shape on their own. */
  const tip = (row: HeatmapRow, unit: HeatmapUnit, index: number) => {
    const cell = row.cells[index];
    if (!cell) return row.displayName;

    const state = t(`state.${cell.state}` as 'state.ok');
    const head = t('heatmap.tipHead', { name: row.displayName, no: unit.no, title: unit.title });

    if (cell.state === 'insufficient') {
      return `${head} — ${t('heatmap.tipInsufficient', {
        sample: cell.weightedSample,
        threshold: data.minWeightedSample,
      })}`;
    }
    if (cell.value !== null) {
      return `${head} — ${t('heatmap.tipMeasured', { value: cell.value })}`;
    }
    return `${head} — ${state}`;
  };

  const lastSeen = (row: HeatmapRow) =>
    row.lastActivityAt === null
      ? t('heatmap.neverSeenShort')
      : format.relativeTime(new Date(row.lastActivityAt), Date.now());

  // Only a measured cell leads anywhere: clicking "not taught yet" would take a teacher
  // to a learner's profile to answer a question that is not about the learner (§B).
  const href = (row: HeatmapRow, unit: HeatmapUnit) => {
    const index = data.units.findIndex((u) => u.unitId === unit.unitId);
    const cell = row.cells[index];
    if (!cell || !isMeasured(cell.state)) return null;
    return `/school/${schoolSlug}/students/${row.studentId}?tab=mastery&unit=${unit.unitId}`;
  };

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-(--ssz-text-primary)">{t('heatmap.title')}</h3>
            <p className="text-xs text-(--ssz-text-secondary)">{t('heatmap.subtitle')}</p>
          </div>
          <Segmented
            size="sm"
            options={[
              { value: 'roster', label: t('heatmap.sortRoster') },
              { value: 'lowest', label: t('heatmap.sortLowest') },
            ]}
            value={sort}
            onValueChange={(next) => setSort(next as typeof sort)}
            aria-label={t('heatmap.sortLabel')}
          />
        </div>

        <details className="space-y-3 sm:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-(--ssz-text-secondary)">
            {t('heatmap.show')}
          </summary>
          <Heatmap
            units={data.units}
            rows={data.rows}
            sort={sort}
            tip={tip}
            href={href}
            lastSeen={lastSeen}
            labels={{ student: t('heatmap.student'), empty: t('heatmap.empty') }}
          />
          <ZeroLegend items={legend} compact />
        </details>

        <div className="hidden space-y-3 sm:block">
          <Heatmap
            units={data.units}
            rows={data.rows}
            sort={sort}
            tip={tip}
            href={href}
            lastSeen={lastSeen}
            labels={{ student: t('heatmap.student'), empty: t('heatmap.empty') }}
          />
          <ZeroLegend items={legend} compact />
        </div>

        {data.rows.some((row) => row.lastActivityAt === null) && (
          <p className="text-xs text-(--ssz-text-muted)">{t('heatmap.neverSeen')}</p>
        )}
      </CardBody>
    </Card>
  );
}
