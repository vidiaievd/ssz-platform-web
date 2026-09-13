import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';

import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getGroupsForSelect } from '@/features/students/api/queries';
import { fetchDashboardKpis, fetchActivity } from '@/lib/dashboard/queries';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { ActivityFeed } from '@/features/dashboard/components/activity-feed';
import { WidgetCard } from '@/features/dashboard/components/widget-card';
import { WidgetEmptyState } from '@/features/dashboard/components/widget-empty-state';
import { Button } from '@/components/ui/button';
import { wsHref } from '@/features/workspaces/lib/href';
import type { ActivityItem, Kpi, WidgetData } from '@/features/dashboard/types';
import type { ActivityPayload, KpisPayload, Unavailable } from '@/lib/dashboard/types';

type Props = {
  workspaceId: string;
};

function isUnavailable(result: object): result is Unavailable {
  return 'status' in result && (result as Unavailable).status === 'unavailable';
}

function kpiByKey(result: KpisPayload | Unavailable): Map<string, Kpi> {
  if (isUnavailable(result)) return new Map();
  return new Map(
    (result.kpis ?? []).map((k) => [
      k.key,
      {
        key: k.key as Kpi['key'],
        value: k.value,
        hint: k.hint,
        spark: k.spark,
        sub: k.sub,
        delta: k.delta ?? undefined,
        trend: k.trend ?? undefined,
      },
    ]),
  );
}

function adaptActivity(result: ActivityPayload | Unavailable): WidgetData<ActivityItem[]> {
  if (isUnavailable(result)) return { status: 'unavailable' };
  if (!result.items || result.items.length === 0) return { status: 'empty' };
  return {
    status: 'ok',
    data: result.items.map((item) => ({
      id: item.id,
      who: item.who ?? 'Someone',
      what: item.what,
      target: item.target ?? '',
      time: item.occurredAt,
      iconKey: 'user' as const,
      tone: 'primary' as const,
      tag: item.tag,
    })),
  };
}

/**
 * A private tutor's front page: what needs them today.
 *
 * Three things, and deliberately not the school's six (plan 59, §5.3). No at-risk list and
 * no course health: a tutor with a dozen learners sees every one of them by name on the
 * roster, and a widget ranking them adds a layer between the tutor and people they know.
 * What is left is what they cannot see by looking — how the week went, what is waiting to
 * be marked, and what happened while they were away.
 */
export async function TutorDashboard({ workspaceId }: Props) {
  const [t, locale] = await Promise.all([getTranslations('Tutor'), getLocale()]);

  let profile: Awaited<ReturnType<typeof getMyProfile>> | null = null;
  let profileError = false;
  try {
    profile = await getMyProfile();
  } catch (err) {
    console.error('[tutor/dashboard] getMyProfile failed:', err);
    profileError = true;
  }

  const [kpisResult, activityResult, groups] = await Promise.all([
    fetchDashboardKpis(workspaceId),
    fetchActivity(workspaceId, 6),
    getGroupsForSelect(workspaceId),
  ]);

  const kpis = kpiByKey(kpisResult);
  const activity = adaptActivity(activityResult);

  // The group the workspace keeps for itself is not one of the tutor's groups — it holds
  // everybody — so a tutor who teaches nobody in a group has no groups line at all.
  const realGroups = groups.filter((g) => !g.isDefault);

  const pending = kpis.get('pending_reviews');
  const pendingCount = typeof pending?.value === 'number' ? pending.value : 0;

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const firstName = profile?.displayName?.split(' ')[0] ?? null;

  return (
    <div className="px-6 py-8 max-w-page mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-(--ssz-text-muted) mb-2">
          {dateLabel}
        </p>
        <h1 className="text-[28px] font-bold tracking-tight text-(--ssz-text-primary) mb-1">
          {firstName
            ? t('dashboard.greetingNamed', { name: firstName })
            : t('dashboard.greeting')}
        </h1>
        <p className="text-sm text-(--ssz-text-secondary)">{t('dashboard.subtitle')}</p>
        {profileError && (
          <p className="mt-1 text-xs text-destructive">{t('dashboard.profileFailed')}</p>
        )}
      </div>

      {/* What the week looks like */}
      <div
        role="list"
        aria-label={t('dashboard.stats.sectionLabel')}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div role="listitem">
          <KpiCard
            label={t('dashboard.stats.students')}
            value={kpis.get('active_students_7d')?.value ?? '—'}
            hint={kpis.get('active_students_7d')?.hint}
            spark={kpis.get('active_students_7d')?.spark}
          />
        </div>
        <div role="listitem">
          <KpiCard
            label={t('dashboard.stats.lessons')}
            value={kpis.get('lessons_completed_7d')?.value ?? '—'}
            hint={kpis.get('lessons_completed_7d')?.hint}
            spark={kpis.get('lessons_completed_7d')?.spark}
          />
        </div>
        {realGroups.length > 0 && (
          <div role="listitem">
            <KpiCard
              label={t('dashboard.stats.groups')}
              value={realGroups.length}
              hint={t('dashboard.stats.groupsHint')}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Waiting to be marked */}
        <WidgetCard
          title={t('dashboard.review.title')}
          subtitle={pendingCount > 0 ? (pending?.sub ?? undefined) : undefined}
          accent={pendingCount > 0}
        >
          {/* On a phone the button drops below the count rather than squeezing it: the
              number is the point of the card and must stay readable. */}
          {pendingCount > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ClipboardCheck className="size-8 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-(--ssz-text-primary)">
                    {t('dashboard.review.waiting', { count: pendingCount })}
                  </p>
                  <p className="text-xs text-(--ssz-text-muted)">{t('dashboard.review.hint')}</p>
                </div>
              </div>
              <Button size="sm" className="w-full sm:w-auto" asChild>
                <Link href={wsHref(workspaceId, 'review')}>{t('dashboard.review.open')}</Link>
              </Button>
            </div>
          ) : (
            <WidgetEmptyState
              title={t('dashboard.review.emptyTitle')}
              body={t('dashboard.review.emptyBody')}
            />
          )}
        </WidgetCard>

        <ActivityFeed activity={activity} />
      </div>
    </div>
  );
}
