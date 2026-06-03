import {
  BookPlus,
  UserPlus,
  GraduationCap,
  Upload,
  Palette,
  FileBarChart,
  FilePlus,
  CalendarPlus,
  ClipboardCheck,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { WidgetCard } from './widget-card';
import type { DashboardRole, QuickAction } from '../types';
import { quickActionsFor } from '../lib/roles';

const ICON_MAP: Record<string, LucideIcon> = {
  BookPlus,
  UserPlus,
  GraduationCap,
  Upload,
  Palette,
  FileBarChart,
  FilePlus,
  CalendarPlus,
  ClipboardCheck,
  MessageSquare,
};

const ACTION_LABELS: Record<string, string> = {
  'new-course': 'New course',
  'invite-teacher': 'Invite teacher',
  'enroll-student': 'Enroll student',
  'import-csv': 'Import CSV',
  'edit-branding': 'Edit branding',
  'monthly-report': 'Monthly report',
  'new-lesson': 'New lesson',
  'schedule-class': 'Schedule class',
  'grade-queue': 'Grade queue',
  'message-class': 'Message class',
};

type QuickActionsProps = {
  role: DashboardRole;
  schoolSlug: string;
};

function resolveHref(action: QuickAction, schoolSlug: string): string {
  // Map actions to existing routes; unbuilt routes get closest existing section
  const routes: Record<string, string> = {
    'new-course': `/school/${schoolSlug}/content`,
    'invite-teacher': `/school/${schoolSlug}/students`, // TODO: dedicated invite page
    'enroll-student': `/school/${schoolSlug}/students`,
    'import-csv': `/school/${schoolSlug}/students`,
    'edit-branding': `/school/${schoolSlug}/settings`,
    'monthly-report': `/school/${schoolSlug}/dashboard`, // TODO: analytics section
    'new-lesson': `/school/${schoolSlug}/content`,
    'schedule-class': `/school/${schoolSlug}/dashboard`, // TODO: schedule section
    'grade-queue': `/school/${schoolSlug}/dashboard`, // TODO: review queue section
    'message-class': `/school/${schoolSlug}/students`,
  };
  return routes[action.id] ?? `/school/${schoolSlug}/dashboard`;
}

export function QuickActions({ role, schoolSlug }: QuickActionsProps) {
  const actions = quickActionsFor(role);

  if (actions.length === 0) return null;

  return (
    <WidgetCard title="Quick actions">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.icon];
          const label = ACTION_LABELS[action.id] ?? action.id;
          const href = resolveHref(action, schoolSlug);

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
