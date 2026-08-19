'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useOversight } from '../../api/use-oversight';
import { useRemindReviewer } from '../../api/use-remind-reviewer';
import { Panel, Segment } from '../primitives';
import { OVERSIGHT_PERIODS, type OversightPeriod } from '../../types/oversight';

import { DecisionLog } from './decision-log';
import { GroupLoadPanel, CourseLoadPanel } from './load-panels';
import { StuckList } from './stuck-list';
import { SchoolSummary } from './school-summary';
import { TeacherLoadRow } from './teacher-load-row';

export interface OversightScreenProps {
  /** The school as the address bar spells it — the BFF takes a slug or an id. */
  school: string;
}

/** The period in the address bar, or thirty days. */
function parsePeriod(raw: string | null): OversightPeriod {
  const value = Number(raw);
  return OVERSIGHT_PERIODS.includes(value as OversightPeriod) ? (value as OversightPeriod) : 30;
}

/**
 * The administrator's screen: where work has piled up, and who could use a hand.
 *
 * A stack of sections rather than a dashboard of widgets, read top to bottom: the school,
 * then the people, then the groups and courses behind them, then the work that has stopped
 * moving, then who decided what. Each section narrows the question the one above it raised,
 * which is what keeps a weekly glance from turning into an investigation (`BEHAVIOR.md` §C).
 *
 * The period lives in the address bar so a view can be sent to a colleague, and it is the
 * only control on the screen — everything else is a consequence of the data.
 */
export function OversightScreen({ school }: OversightScreenProps) {
  const t = useTranslations('Review.oversight');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const period = parsePeriod(searchParams.get('period'));
  const { data, isPending, isError, refetch } = useOversight(school, period);
  const remind = useRemindReviewer(school);

  // One toast for all three outcomes, because from the administrator's side they are one
  // answer to one press: it went, it went nowhere because it went yesterday, or it failed.
  const sendReminder = useCallback(
    (teacherId: string, name: string | null) => {
      remind.mutate(teacherId, {
        onSuccess: (result) => {
          if (result.sent) {
            toast.success(t('teachers.reminded', { name: name ?? '', n: result.pending }));
          } else {
            toast.info(t('teachers.remindedAlready', { hours: result.retryAfterHours ?? 24 }));
          }
        },
        onError: () => toast.error(t('teachers.remindFailed')),
      });
    },
    [remind, t],
  );

  const setPeriod = useCallback(
    (next: string) => {
      const query = new URLSearchParams(searchParams.toString());
      query.set('period', next);
      // `replace`: switching between seven and ninety days is looking at one thing from
      // two distances, not two places to walk back through.
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-8 pb-14 pt-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="mb-[5px] text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t('eyebrow')}
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('title')}</h1>
          <p className="mt-1 max-w-[640px] text-[13.5px] text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Segment
          aria-label={t('period.label')}
          value={String(period)}
          onChange={setPeriod}
          options={OVERSIGHT_PERIODS.map((days) => ({
            value: String(days),
            label: t('period.days', { n: days }),
          }))}
        />
      </header>

      {isError ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-border bg-(--ssz-bg-surface) px-5 py-4"
        >
          <p className="flex-1 text-sm text-muted-foreground">{t('failed')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {data === undefined ? (
        isPending ? (
          <>
            <Skeleton className="h-[220px] rounded-[14px]" />
            <Skeleton className="h-[240px] rounded-[14px]" />
          </>
        ) : null
      ) : (
        <>
          <SchoolSummary data={data} />

          <Panel title={t('teachers.title')} sub={t('teachers.sub')} bodyClassName="px-2 pb-3 pt-2">
            {data.teachers.length === 0 ? (
              <p className="px-3 py-2 text-[12.5px] text-muted-foreground">{t('teachers.empty')}</p>
            ) : (
              data.teachers.map((teacher) => (
                <TeacherLoadRow
                  key={teacher.id}
                  teacher={teacher}
                  slaHours={data.schoolSlaHours}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remind.isPending}
                        onClick={() => sendReminder(teacher.id, teacher.name)}
                      >
                        <Bell aria-hidden className="size-3.5" />
                        {t('teachers.remind')}
                      </Button>
                    </>
                  }
                />
              ))
            )}
          </Panel>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
            <GroupLoadPanel groups={data.groups} slaHours={data.schoolSlaHours} />
            <CourseLoadPanel courses={data.courses} />
          </div>

          <StuckList
            items={data.stuck}
            reviewHref={(id) => `/school/${school}/review?submission=${encodeURIComponent(id)}`}
            onAssign={() => undefined}
          />

          <DecisionLog school={school} period={period} />
        </>
      )}
    </div>
  );
}
