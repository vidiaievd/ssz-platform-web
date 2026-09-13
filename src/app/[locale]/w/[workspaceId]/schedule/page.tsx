import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { getMySchedule } from '@/features/schedule/api/get-my-schedule';
import { ScheduleGrid } from '@/features/schedule/components/schedule-grid';
import { AddLessonDialog } from '@/features/schedule/components/add-lesson-dialog';
import { getGroupsForSelect } from '@/features/students/api/queries';
import { isoDay, parseDay, rangeOf, shift, type RangeKind } from '@/features/schedule/lib/range';
import { Button } from '@/components/ui/button';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
  searchParams: Promise<{ view?: string; on?: string }>;
};

/**
 * What a teacher is teaching, week by week — the screen a private tutor opens (plan 62).
 *
 * Server-rendered, and navigated by links rather than by state: a week is a place, so it
 * has an address, and "the week of the 14th" survives a refresh, a bookmark and a share.
 */
export default async function SchedulePage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const { view, on } = await searchParams;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  const [t, format] = await Promise.all([getTranslations('Scheduling.my'), getFormatter()]);

  const kind: RangeKind = view === 'month' ? 'month' : 'week';
  const today = new Date();
  const anchor = parseDay(on) ?? today;
  const range = rangeOf(kind, anchor);

  const [{ sessions, error }, groups] = await Promise.all([
    getMySchedule(workspace.id, range),
    getGroupsForSelect(workspace.id),
  ]);

  // Whom an extra lesson can be with: everybody the tutor actually teaches. The group the
  // workspace keeps for itself holds all of them and teaches none, so it is not offered.
  const targets = groups
    .filter((group) => !group.isDefault)
    .map((group) => ({ groupId: group.id, title: group.name }));

  const href = (next: { kind?: RangeKind; on?: Date | null }) => {
    const nextKind = next.kind ?? kind;
    const params = new URLSearchParams();
    if (nextKind === 'month') params.set('view', 'month');
    if (next.on) params.set('on', isoDay(next.on));
    const query = params.toString();
    return `${wsHref(workspaceId, 'schedule')}${query ? `?${query}` : ''}`;
  };

  const rangeLabel =
    kind === 'month'
      ? format.dateTime(new Date(`${range.from}T00:00:00.000Z`), {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : `${format.dateTime(new Date(`${range.from}T00:00:00.000Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${format.dateTime(new Date(`${range.to}T00:00:00.000Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Two scales of one question, the way back to now, and one more lesson. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            <Button
              variant={kind === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8"
              asChild
            >
              <Link href={href({ kind: 'week', on: anchor })}>{t('week')}</Link>
            </Button>
            <Button
              variant={kind === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8"
              asChild
            >
              <Link href={href({ kind: 'month', on: anchor })}>{t('month')}</Link>
            </Button>
          </div>

          <Button variant="outline" size="icon-sm" asChild aria-label={t('previous')}>
            <Link href={href({ on: shift(kind, anchor, -1) })}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={href({ on: null })}>{t('today')}</Link>
          </Button>
          <Button variant="outline" size="icon-sm" asChild aria-label={t('next')}>
            <Link href={href({ on: shift(kind, anchor, 1) })}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          <AddLessonDialog
            workspaceId={workspace.id}
            targets={targets}
            defaultDate={isoDay(anchor)}
          />
        </div>
      </div>

      <p className="text-sm font-medium text-(--ssz-text-primary)">
        {rangeLabel}
        <span className="ml-2 font-normal text-muted-foreground">
          {t('count', { count: sessions.length })}
        </span>
      </p>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('loadFailed')}
        </p>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-base font-medium">{kind === 'month' ? t('emptyMonth') : t('emptyWeek')}</p>
          <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
        </div>
      ) : (
        <ScheduleGrid
          kind={kind}
          range={range}
          sessions={sessions}
          workspaceId={workspaceId}
          today={isoDay(today)}
        />
      )}
    </main>
  );
}
