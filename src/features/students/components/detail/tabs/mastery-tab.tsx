import { getTranslations } from 'next-intl/server';

import {
  MasteryCell,
  Note,
  PositionScale,
  SkillGrid,
  Stat,
  ZeroLegend,
  rampInk,
  type LegendItem,
  type MasteryCellData,
} from '@/features/analytics';
import type { StudentGrid, StudentPosition, StudentWorkContext } from '@/features/analytics/types';
import type { MasteryProfile, MasteryVerdict, WeaknessReason } from '@/features/mastery/types';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { FOCUSES, SKILLS } from '@/lib/shared-kernel/skills/model';

import { getStudentMastery } from '../../../api/get-student-mastery';

type Translate = Awaited<ReturnType<typeof getTranslations<'Analytics'>>>;

/**
 * How a `skill × focus` pair is named.
 *
 * Taken from the `Mastery` namespace rather than restated here: the learner's own screens
 * already name these pairs, and two dictionaries for the same four channels is how the
 * teacher's grid and the learner's card end up calling the same thing by two names.
 */
interface Naming {
  skill: (skill: string) => string;
  focus: (focus: string) => string;
  pair: (skill: string, focus: string) => string;
}

/**
 * The grid's subject axis — the four named subjects plus the bucket an attempt lands in
 * when nothing could classify it. That bucket carries almost all of the traffic today,
 * and a grid without the column would look empty for entirely the wrong reason.
 */
const FOCUS_AXIS = [...FOCUSES, 'unknown'] as const;

/** At most three: a list of things to work on that scrolls is a list nobody acts on. */
const MAX_WEAK = 3;

/** How each kind of weakness is badged — the label is copy, the tone is a reading of it. */
const REASON_TONE: Record<WeaknessReason, BadgeProps['variant']> = {
  forgets: 'warning',
  'never-knew': 'error',
  watch: 'info',
};

/**
 * Screen C — one learner's profile on the school side, plan 58 phase 9.
 *
 * Five blocks, and the order is the argument: how much of the taught course this learner
 * took away, what the practice looks like pair by pair, what to do about the weakest of
 * them, where the work happens, and only then where they stand against the group. The
 * comparison comes last on purpose — it is the least actionable number on the screen.
 *
 * A learner with no attempt at all gets no grid. An empty grid reads as a bad grid, and
 * "we have measured nothing yet" is not a verdict about anybody.
 */
export async function MasteryTab({
  schoolId,
  schoolSlug,
  studentId,
  groups,
  assignHref,
}: {
  schoolId: string;
  schoolSlug: string;
  studentId: string;
  /** The learner's active groups, most relevant first; empty for a learner in none. */
  groups: ReadonlyArray<{ id: string; name: string }>;
  assignHref: string;
}) {
  const t = await getTranslations('Analytics');
  const tm = await getTranslations('Mastery');
  const data = await getStudentMastery({
    schoolId,
    studentId,
    groupIds: groups.map((group) => group.id),
  });

  const skill = (value: string) => tm(`skill.${value}` as 'skill.reading');
  const focus = (value: string) => tm(`focus.${value}` as 'focus.grammar');
  const naming: Naming = {
    skill,
    focus,
    pair: (s, f) => tm('cell', { skill: skill(s), focus: focus(f) }),
  };

  // Analytics being unreachable empties this tab and says so. Drawn as a learner with
  // nothing behind them, it would be a claim about the learner rather than the service.
  if (data.grid === null) {
    return (
      <Note tone="warn" icon="warn">
        {t('unavailable')}
      </Note>
    );
  }

  if (data.grid.nothingMeasured) {
    return (
      <Card>
        <CardBody className="space-y-2 py-10 text-center">
          <h3 className="text-base font-bold text-(--ssz-text-primary)">
            {t('mastery.empty.title')}
          </h3>
          <p className="mx-auto max-w-md text-sm text-(--ssz-text-secondary)">
            {t('mastery.empty.body')}
          </p>
          <div className="pt-1">
            <Button asChild size="sm">
              <a href={assignHref}>{t('mastery.empty.action')}</a>
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Which group these numbers belong to, and a way to the others. A learner in three
          groups has three sets of numbers, and a screen that silently picks one is a
          screen that occasionally answers a question nobody asked. */}
      {groups.length > 1 && (
        <p className="text-xs text-(--ssz-text-secondary)">
          {t('mastery.group.readAgainst', {
            name: groups.find((group) => group.id === data.groupId)?.name ?? '—',
          })}{' '}
          {groups
            .filter((group) => group.id !== data.groupId)
            .map((group) => (
              <a
                key={group.id}
                href={`/school/${schoolSlug}/students/${studentId}?tab=mastery&group=${group.id}`}
                className="ml-2 underline underline-offset-2 hover:text-(--ssz-text-primary)"
              >
                {group.name}
              </a>
            ))}
        </p>
      )}

      <Summary
        grid={data.grid}
        position={data.position}
        profile={data.profile}
        workContext={data.workContext}
        t={t}
      />

      {/* The grid takes the full width: five subjects need about 520px, and squeezed
          into half of a laptop the last column falls off the edge — which reads as a
          broken table rather than as a column to scroll to. */}
      <Grid grid={data.grid} naming={naming} t={t} />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <WhatToWorkOn profile={data.profile} schoolSlug={schoolSlug} naming={naming} t={t} />

        <div className="space-y-5">
          <WhereTheWorkHappens workContext={data.workContext} t={t} />
          <AgainstTheGroup position={data.position} t={t} />
        </div>
      </div>
    </div>
  );
}

function Summary({
  grid,
  position,
  profile,
  workContext,
  t,
}: {
  grid: StudentGrid;
  position: StudentPosition | null;
  profile: MasteryProfile | null;
  workContext: StudentWorkContext | null;
  t: Translate;
}) {
  const attempts =
    grid.cells.reduce((sum, cell) => sum + cell.attempts, 0) + grid.unclassifiedAttempts;
  // Cells named as weak, `watch` excluded: "listed first" is not "wrong", and counting
  // the two together would report a healthy profile as three problems.
  const weak = (profile?.weakest ?? []).filter((verdict) => verdict.reason !== 'watch').length;
  const notJudgeable = grid.cells.filter((cell) => cell.state === 'insufficient').length;

  return (
    <Card>
      <CardBody>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label={t('mastery.summary.own')}
            value={position === null ? '—' : `${position.own}%`}
            sub={
              position === null
                ? t('mastery.summary.ownNoScale')
                : t('mastery.summary.ownSub', { median: position.groupMedian })
            }
            tone="primary"
          />
          <Stat
            label={t('mastery.summary.inGroup')}
            value={position === null ? '—' : `p${position.percentile}`}
            sub={
              position === null
                ? t('mastery.summary.inGroupNoScale')
                : t('mastery.summary.inGroupSub', {
                    lower: position.lowerThan,
                    measured: position.measured,
                  })
            }
          />
          <Stat
            label={t('mastery.summary.attempts')}
            value={String(attempts)}
            sub={
              workContext === null || workContext.unattributed === 0
                ? undefined
                : t('mastery.summary.attemptsSub', { count: workContext.unattributed })
            }
          />
          <Stat
            label={t('mastery.summary.weakPairs')}
            value={profile === null ? '—' : String(weak)}
            sub={t('mastery.summary.weakPairsSub')}
            tone={weak > 0 ? 'danger' : 'neutral'}
          />
          <Stat
            label={t('summary.notJudgeable')}
            value={String(notJudgeable)}
            sub={t('summary.notJudgeableSub', { threshold: grid.minWeightedSample })}
            hint={t('summary.notJudgeableHint', { threshold: grid.minWeightedSample })}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function Grid({ grid, naming, t }: { grid: StudentGrid; naming: Naming; t: Translate }) {
  const byCell = new Map(grid.cells.map((cell) => [`${cell.skill}:${cell.focus}`, cell]));

  const legend: LegendItem[] = [
    { key: 'scale', label: t('mastery.legend.scale') },
    { key: 'notStarted', label: t('state.notStarted') },
    { key: 'insufficient', label: t('state.insufficient') },
    { key: 'noContent', label: t('state.noContent') },
  ];

  const labels = {
    noItems: t('mastery.cell.noItems'),
    notStarted: t('mastery.cell.notStarted'),
    stable: (days: number) => t('mastery.cell.stable', { days }),
    shortfall: (sample: number, threshold: number) =>
      t('mastery.cell.shortfall', { sample, threshold }),
  };

  const tip = (cell: MasteryCellData | undefined, skill: string, focus: string): string => {
    const pair = naming.pair(skill, focus);
    if (!cell) return pair;

    switch (cell.state) {
      case 'insufficient':
        return `${pair} — ${t('heatmap.tipInsufficient', {
          sample: Math.round(cell.weightedSample * 10) / 10,
          threshold: grid.minWeightedSample,
        })}`;
      case 'notStarted':
        return `${pair} — ${t('state.notStarted')}`;
      case 'ok':
      case 'low':
        return `${pair} — ${t('mastery.cell.tipMeasured', { value: cell.ewma ?? 0 })}`;
      default:
        return `${pair} — ${t('state.noContent')}`;
    }
  };

  return (
    <Card>
      <CardBody className="space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-(--ssz-text-primary)">{t('mastery.grid.title')}</h3>
          <p className="text-xs text-(--ssz-text-secondary)">
            {t('mastery.grid.subtitle', { threshold: grid.minWeightedSample })}
          </p>
        </div>

        <SkillGrid
          skills={SKILLS}
          foci={FOCUS_AXIS}
          cell={(skill, focus) => byCell.get(`${skill}:${focus}`)}
          renderCell={(cell, skill, focus) => (
            <MasteryCell
              cell={cell}
              minWeightedSample={grid.minWeightedSample}
              labels={labels}
              tip={tip(cell, skill, focus)}
            />
          )}
          rowLabel={naming.skill}
          colLabel={naming.focus}
        />

        <ZeroLegend items={legend} compact />

        {/* Whole empty rows are the normal shape of this grid today, and every one of
            them is a fact about the catalogue. Left unexplained beside a learner's name,
            they read as a verdict on the learner. */}
        <Note>
          {t('mastery.grid.note')}
          {grid.unclassifiedAttempts > 0
            ? ` ${t('mastery.grid.unclassified', { count: grid.unclassifiedAttempts })}`
            : ''}
          {grid.coverageUnavailable ? ` ${t('mastery.grid.coverageUnavailable')}` : ''}
        </Note>
      </CardBody>
    </Card>
  );
}

/**
 * The weakest pairs with the reason each one is weak — the block the screen exists for.
 *
 * Two cells with the same 38% get opposite advice, and only `meanStability` tells them
 * apart: one is forgotten between lessons and needs reviewing sooner, the other was
 * learnt wrong and needs teaching again. The percentage is shown, but it is not the
 * finding — the label is.
 */
function WhatToWorkOn({
  profile,
  schoolSlug,
  naming,
  t,
}: {
  profile: MasteryProfile | null;
  schoolSlug: string;
  naming: Naming;
  t: Translate;
}) {
  if (profile === null) {
    return (
      <Card>
        <CardBody>
          <Note tone="warn" icon="warn">
            {t('mastery.work.unavailable')}
          </Note>
        </CardBody>
      </Card>
    );
  }

  const cells = profile.weakest.slice(0, MAX_WEAK);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-(--ssz-text-primary)">{t('mastery.work.title')}</h3>
          <p className="text-xs text-(--ssz-text-secondary)">{t('mastery.work.subtitle')}</p>
        </div>

        {cells.length === 0 ? (
          <p className="text-sm text-(--ssz-text-secondary)">{t('mastery.work.empty')}</p>
        ) : (
          <ul className="space-y-2.5">
            {cells.map((verdict) => (
              <WeakRow
                key={`${verdict.skill}:${verdict.focus}`}
                verdict={verdict}
                schoolSlug={schoolSlug}
                naming={naming}
                t={t}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function WeakRow({
  verdict,
  schoolSlug,
  naming,
  t,
}: {
  verdict: MasteryVerdict;
  schoolSlug: string;
  naming: Naming;
  t: Translate;
}) {
  const value = Math.round(verdict.successRateEwma * 100);
  const reason = verdict.reason;

  return (
    <li className="rounded-xl border-[1.5px] border-(--ssz-border-default) bg-(--ssz-bg-surface) px-3.5 py-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-bold text-(--ssz-text-primary)">
          {naming.pair(verdict.skill, verdict.focus)}
        </span>
        {reason === null ? null : (
          <Badge variant={REASON_TONE[reason]}>
            {t(`mastery.reason.${reason}.label` as 'mastery.reason.forgets.label')}
          </Badge>
        )}
        <span className="flex-1" />
        <span className="text-xs font-bold" style={{ color: rampInk(value) }}>
          {value}%
        </span>
      </div>

      <div className="mb-1.5 flex flex-wrap gap-3.5 text-[11.5px] text-(--ssz-text-muted)">
        {verdict.meanStability === null ? null : (
          <span>
            {t('mastery.work.stability', { days: Math.round(verdict.meanStability * 10) / 10 })}
          </span>
        )}
        <span>{t('mastery.work.samples', { count: Math.round(verdict.weightedSample) })}</span>
      </div>

      <p className="text-[12.5px] leading-[1.5] text-(--ssz-text-secondary)">
        {reason === null
          ? t('mastery.reason.unknown.body')
          : t(`mastery.reason.${reason}.body` as 'mastery.reason.forgets.body')}
      </p>

      {/* The course is where anything is actually done about this, so the row ends with
          a way there rather than with a number to admire. */}
      <a
        href={`/school/${schoolSlug}/content`}
        className="mt-2 inline-block text-[12px] font-semibold text-(--ssz-text-secondary) underline underline-offset-2 hover:text-(--ssz-text-primary)"
      >
        {t('mastery.work.action')}
      </a>
    </li>
  );
}

/** One bar, not a second chart: where this learner's work is done, and how it goes. */
function WhereTheWorkHappens({
  workContext,
  t,
}: {
  workContext: StudentWorkContext | null;
  t: Translate;
}) {
  if (workContext === null) return null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-(--ssz-text-primary)">
            {t('mastery.context.title')}
          </h3>
          <p className="text-xs text-(--ssz-text-secondary)">{t('mastery.context.subtitle')}</p>
        </div>

        <ul className="space-y-2">
          {workContext.buckets.map((bucket) => {
            const key = bucket.key ?? 'unsaid';
            const unsaid = bucket.key === null;
            return (
              <li key={key} className="grid grid-cols-[96px_1fr_auto] items-center gap-2.5">
                <span
                  className={
                    unsaid
                      ? 'text-xs font-semibold text-(--ssz-text-muted)'
                      : 'text-xs font-semibold text-(--ssz-text-primary)'
                  }
                >
                  {t(`context.${key}` as 'context.homework')}
                </span>
                <div className="h-2.25 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
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
                <span className="text-[11.5px] text-(--ssz-text-muted) tabular-nums">
                  {bucket.median === null ? '—' : `${bucket.median}%`} ·{' '}
                  {t('context.attempts', { count: bucket.attempts })}
                </span>
              </li>
            );
          })}
        </ul>

        {workContext.unattributed > 0 && (
          <Note>{t('context.unattributed', { count: workContext.unattributed })}</Note>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * One line, and nothing when there is no line to draw.
 *
 * A group where nobody has been measured has no median, and inventing a zero for it would
 * put this learner at the bottom of a ranking that does not exist.
 */
function AgainstTheGroup({ position, t }: { position: StudentPosition | null; t: Translate }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <h3 className="text-sm font-bold text-(--ssz-text-primary)">
          {t('mastery.position.title')}
        </h3>

        {position === null ? (
          <p className="text-[12.5px] leading-[1.5] text-(--ssz-text-secondary)">
            {t('mastery.position.none')}
          </p>
        ) : (
          <>
            <PositionScale
              own={position.own}
              median={position.groupMedian}
              medianLabel={t('mastery.position.median')}
              ownLabel={t('mastery.position.own')}
            />
            <p className="text-[12.5px] leading-[1.5] text-(--ssz-text-secondary)">
              {t('mastery.position.body', {
                own: position.own,
                median: position.groupMedian,
                lower: position.lowerThan,
              })}
            </p>
            <p className="text-[11.5px] text-(--ssz-text-muted)">
              {t('mastery.position.measured', { measured: position.measured })}
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
