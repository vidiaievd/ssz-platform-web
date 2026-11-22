import {
  BookPlus,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  FilePlus,
  GraduationCap,
  Layers,
  MessageSquare,
  Palette,
  Upload,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { cn } from '@/lib/utils';
import { wsHref } from '@/features/workspaces/lib/href';
import { WidgetCard } from './widget-card';
import type { DashboardRole, QuickAction } from '../types';
import { quickActionsFor } from '../lib/roles';

const ICON_MAP: Record<string, LucideIcon> = {
  BookPlus,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  FilePlus,
  GraduationCap,
  Layers,
  MessageSquare,
  Palette,
  Upload,
  UserPlus,
};

type QuickActionsProps = {
  role: DashboardRole;
  workspaceId: string;
  /** Suspended or closed school: only the shortcuts that look. */
  readOnly?: boolean;
};

function resolveHref(action: QuickAction, workspaceId: string): string {
  const routes: Record<string, string> = {
    'new-course':        wsHref(workspaceId, 'content'),
    'new-group':         wsHref(workspaceId, 'groups/new'),
    'invite-teacher':    wsHref(workspaceId, 'students'),
    'enroll-student':    wsHref(workspaceId, 'students'),
    'import-csv':        wsHref(workspaceId, 'students'),
    'edit-branding':     wsHref(workspaceId, 'settings/school'),
    'teacher-timetable': wsHref(workspaceId, 'groups/timetable'),
    'monthly-report':    wsHref(workspaceId, 'dashboard'),
    'new-lesson':        wsHref(workspaceId, 'content'),
    'my-groups':         wsHref(workspaceId, 'groups'),
    'my-timetable':      wsHref(workspaceId, 'my-schedule'),
    'schedule-class':    wsHref(workspaceId, 'groups'),
    'grade-queue':       wsHref(workspaceId, 'dashboard'),
    'message-class':     wsHref(workspaceId, 'students'),
  };
  return routes[action.id] ?? wsHref(workspaceId, 'dashboard');
}

/** Shortcuts that only open a screen to look at; the rest create or change something. */
const VIEW_ONLY_ACTIONS = new Set(['teacher-timetable', 'monthly-report', 'my-groups', 'my-timetable']);

export function QuickActions({ role, workspaceId, readOnly = false }: QuickActionsProps) {
  const t = useTranslations('School.dashboard.quick');
  // A suspended or closed school keeps only the shortcuts that look (plan 90, live check, block 9).
  const actions = quickActionsFor(role).filter((a) => !readOnly || VIEW_ONLY_ACTIONS.has(a.id));

  if (actions.length === 0) return null;

  return (
    <WidgetCard title={t('title')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.icon];
          const key = `actions.${action.id}` as Parameters<typeof t>[0];
          const label = t.has(key) ? t(key) : action.id;
          const href = resolveHref(action, workspaceId);

          return (
            <Link
              key={action.id}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                'text-(--ssz-text-secondary) hover:bg-accent hover:text-(--ssz-text-primary)',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </WidgetCard>
  );
}
