import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { NudgeAllButton } from './nudge-all-button';
import type { WidgetData, AtRiskStudent } from '../types';

type AtRiskListProps = {
  atRisk: WidgetData<{ students: AtRiskStudent[]; total: number }>;
  workspaceId: string;
  schoolId: string;
};

function formatLastSeen(
  iso: string,
  t: ReturnType<typeof useTranslations<'School.dashboard.atRisk'>>,
): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return t('never');
  return days <= 0 ? t('today') : t('daysAgo', { count: days });
}

export function AtRiskList({ atRisk, workspaceId, schoolId }: AtRiskListProps) {
  const t = useTranslations('School.dashboard.atRisk');
  if (atRisk.status === 'unavailable') {
    return <WidgetCard title={t('title')} unavailable />;
  }

  const { students, total } = atRisk.status === 'ok'
    ? atRisk.data
    : { students: [] as AtRiskStudent[], total: 0 };

  const footerRight = (
    <NudgeAllButton count={total} workspaceId={workspaceId} schoolId={schoolId} />
  );

  return (
    <WidgetCard
      title={t('title')}
      subtitle={total > students.length ? t('subtitleTotal', { total }) : t('subtitle')}
      headerRight={total > 0 ? footerRight : undefined}
      empty={
        students.length === 0 ? (
          <WidgetEmptyState icon={Users} title={t('emptyTitle')} body={t('emptyBody')} />
        ) : undefined
      }
    >
      {students.length > 0 && (
        <ul
          role="list"
          aria-label={t('title')}
          className="divide-y divide-border -mx-4 -mb-4"
        >
          {students.map((student) => {
            const pct = Math.round(student.progress * 100);
            return (
              <li key={student.userId} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                  aria-hidden="true"
                >
                  {student.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{student.name}</p>
                  <p className="font-mono text-[11px] text-(--ssz-text-muted) truncate">
                    {student.course} · {student.lastSeen ? formatLastSeen(student.lastSeen, t) : t('never')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm text-(--ssz-text-muted)">{pct}%</span>
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-(--ssz-text-secondary) uppercase"
                    aria-label={t('language', { lang: student.lang })}
                  >
                    {student.lang}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
