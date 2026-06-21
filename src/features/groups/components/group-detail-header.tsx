import { cn } from '@/lib/utils';
import { GroupStatusPill } from './group-status-pill';
import { GroupDetailActions } from './group-detail-actions';
import { HeaderRiskChip } from './header-risk-chip';
import { CourseChip } from './course-chip';
import type { Group, CourseView } from '../types';
import type { Alert } from '@/features/dashboard/types';

// ── Lang tile ─────────────────────────────────────────────────────────────────

function LangTile({ lang }: { lang: string }) {
  return (
    <div
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-xl',
        'text-sm font-bold uppercase tracking-wide',
        'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
      )}
      aria-label={`Language: ${lang}`}
    >
      {lang.slice(0, 2)}
    </div>
  );
}

// ── Fact row ──────────────────────────────────────────────────────────────────

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-(--ssz-text-muted)">{label}</span>
      <span className="font-medium text-(--ssz-text-secondary)">{value}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  group: Group;
  alerts: Alert[];
  courseView: CourseView;
  schoolSlug: string;
  canManage: boolean;
};

export function GroupDetailHeader({ group, alerts, courseView, schoolSlug, canManage }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <LangTile lang={group.lang} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-(--ssz-text-primary) leading-tight truncate">
              {group.name}
            </h1>
            <GroupStatusPill status={group.status} />
            <HeaderRiskChip alerts={alerts} />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-sm flex-wrap">
            <CourseChip courseView={courseView} />
            {group.level && <Fact label="Level" value={group.level} />}
            <Fact label="Mode" value={group.mode === 'online' ? 'Online' : 'In-person'} />
          </div>
        </div>
      </div>

      {canManage && (
        <GroupDetailActions
          group={group}
          schoolSlug={schoolSlug}
        />
      )}
    </div>
  );
}
