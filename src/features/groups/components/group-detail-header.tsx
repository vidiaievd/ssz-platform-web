import { cn } from '@/lib/utils';
import { GroupStatusPill } from './group-status-pill';
import { GroupDetailActions } from './group-detail-actions';
import type { Group } from '../types';

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

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  group: Group;
  schoolSlug: string;
  canManage: boolean;
};

export function GroupDetailHeader({ group, schoolSlug, canManage }: Props) {
  const metaParts = [group.courseName, group.level, group.mode === 'online' ? 'Online' : 'In-person']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <LangTile lang={group.lang} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-(--ssz-text-primary) leading-tight truncate">
            {group.name}
          </h1>
          {metaParts && (
            <p className="mt-0.5 text-sm text-(--ssz-text-secondary) font-mono truncate">
              {metaParts}
            </p>
          )}
          <div className="mt-1.5">
            <GroupStatusPill status={group.status} />
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
