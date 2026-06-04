import { cn } from '@/lib/utils';
import type { TeacherLoad } from '@/features/dashboard/types';

type TeacherWorkloadBarProps = {
  teacher: TeacherLoad;
};

function barColor(pct: number): string {
  if (pct > 100) return 'bg-error-500 dark:bg-error-600';
  if (pct >= 85) return 'bg-warning-500 dark:bg-warning-600';
  return 'bg-primary';
}

export function TeacherWorkloadBar({ teacher }: TeacherWorkloadBarProps) {
  const { name, hours, max, pct, overloaded, groups, langs, conflicts } = teacher;
  const fill = Math.min(pct, 100);

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold uppercase text-primary"
        aria-hidden="true"
      >
        {name.slice(0, 2)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-(--ssz-text-primary) truncate">{name}</span>
          <span className="shrink-0 text-xs text-(--ssz-text-muted) font-mono">
            {hours.toFixed(1)}/{max}h
          </span>
        </div>

        <div className="hidden sm:block text-xs text-(--ssz-text-muted) mb-1.5 truncate">
          {groups} {groups === 1 ? 'group' : 'groups'}
          {langs && langs.length > 0 ? ` · ${langs.join(', ')}` : ''}
        </div>

        <div
          role="progressbar"
          aria-label={`${name}: ${hours.toFixed(1)} of ${max} contracted hours${overloaded ? ', overloaded' : ''}`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full rounded-full bg-border overflow-hidden"
        >
          <div
            className={cn('h-full rounded-full transition-[width]', barColor(pct))}
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {overloaded && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400">
            +{(hours - max).toFixed(1)}h over
          </span>
        )}
        {conflicts > 0 && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400">
            {conflicts} clash
          </span>
        )}
      </div>
    </li>
  );
}
