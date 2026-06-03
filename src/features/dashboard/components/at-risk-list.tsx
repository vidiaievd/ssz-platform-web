import { Users } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { NudgeAllButton } from './nudge-all-button';
import type { WidgetData, AtRiskStudent } from '../types';

type AtRiskListProps = {
  atRisk: WidgetData<{ students: AtRiskStudent[]; total: number }>;
  schoolSlug: string;
  schoolId: string;
};

function formatLastSeen(iso: string): string {
  try {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  } catch {
    return 'unknown';
  }
}

export function AtRiskList({ atRisk, schoolSlug, schoolId }: AtRiskListProps) {
  if (atRisk.status === 'unavailable') {
    return <WidgetCard title="At-risk students" loading />;
  }

  const { students, total } = atRisk.status === 'ok'
    ? atRisk.data
    : { students: [] as AtRiskStudent[], total: 0 };

  const footerRight = (
    <NudgeAllButton count={total} schoolSlug={schoolSlug} schoolId={schoolId} />
  );

  return (
    <WidgetCard
      title="At-risk students"
      subtitle={`Inactive 7+ days${total > students.length ? ` · ${total} total` : ''}`}
      headerRight={total > 0 ? footerRight : undefined}
      empty={
        students.length === 0 ? (
          <WidgetEmptyState icon={Users} title="No at-risk students" body="All students are active — great work!" />
        ) : undefined
      }
    >
      {students.length > 0 && (
        <ul
          role="list"
          aria-label="At-risk students"
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
                    {student.course} · {student.lastSeen ? formatLastSeen(student.lastSeen) : 'never active'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm text-(--ssz-text-muted)">{pct}%</span>
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600 uppercase"
                    aria-label={`language: ${student.lang}`}
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
