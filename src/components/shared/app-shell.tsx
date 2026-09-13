'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bell,
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MailCheck,
  Search,
  Gauge,
  SquareCheckBig,
  Send,
  Settings,
  Users,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { CurrentUser } from '@/features/auth/types/current-user';
import type { DashboardRole, SchoolType } from '@/features/dashboard/types';
import type { SchoolRole } from '@/features/school/types';
import { navGating } from '@/features/dashboard/lib/roles';
import { NotificationBell } from '@/features/notifications';
import type { NotificationLinkContext } from '@/features/notifications';
import { useReviewsSummary } from '@/features/learning/api/use-reviews-summary';
import { useReviewQueueCount } from '@/features/review/api/use-review-queue';
import { WorkspaceSwitcher, RoleBadge } from '@/features/workspaces';
import { wsHref } from '@/features/workspaces/lib/href';
import { AlertBadge } from './topbar/alert-badge';
import { GlobalSearchTrigger } from './topbar/global-search-trigger';
import { TrialPill } from './topbar/trial-pill';
import { Sidebar } from './sidebar/sidebar';
import { MobileSidebar } from './sidebar/mobile-sidebar';
import { BottomTabBar } from './sidebar/bottom-tab-bar';
import { Topbar } from './topbar/topbar';
import { TopbarSlot, TopbarSlotProvider } from './topbar/topbar-slot';
import type { NavSection } from './sidebar/types';
import type { UserMenuExtraItem } from './topbar/user-menu';

export type SchoolContext = {
  role: DashboardRole;
  /** Original SchoolRole from org-service — used for role badge and page-level guards */
  schoolRole?: SchoolRole;
  schoolType: SchoolType;
  school: { name: string; slug: string };
  schoolId: string;
};

const SCHEDULING_SCHOOL_ROLES = new Set<SchoolRole>(['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER']);

/** Who runs a school's review, as opposed to doing it (`BEHAVIOR.md` §C). */
const REVIEW_OVERSIGHT_ROLES = new Set<SchoolRole>(['OWNER', 'ADMIN', 'MANAGER']);

/** What the marking inbox contributes to the nav; absent for anyone without a queue. */
type ReviewNav = { pending: number; hasOverdue: boolean } | null;

function buildSchoolNav(
  workspaceId: string,
  schoolCtx?: SchoolContext,
  review: ReviewNav = null,
): NavSection[] {
  const gating = schoolCtx ? navGating(schoolCtx.role) : null;

  function disabled(
    navId:
      | 'dashboard'
      | 'courses'
      | 'groups'
      | 'students'
      | 'teachers'
      | 'scheduling'
      | 'invitations'
      | 'settings',
  ): boolean {
    return gating ? gating[navId] === 'locked' : false;
  }

  const canOverseeReview =
    !!schoolCtx?.schoolRole && REVIEW_OVERSIGHT_ROLES.has(schoolCtx.schoolRole);

  const canSeeScheduling =
    !!schoolCtx?.schoolRole && SCHEDULING_SCHOOL_ROLES.has(schoolCtx.schoolRole);

  const mainItems = [
    {
      href: wsHref(workspaceId, 'dashboard'),
      icon: LayoutDashboard,
      labelKey: 'dashboard',
      disabled: disabled('dashboard'),
      lockReason: 'Nav.locked.ownerOnly',
    },
    ...(review
      ? [
          {
            href: wsHref(workspaceId, 'review'),
            icon: SquareCheckBig,
            labelKey: 'review',
            badge: review.pending,
            badgeAlert: review.hasOverdue,
            // Own item, own highlight: oversight lives under the inbox's path, and the
            // default prefix match would light both up at once.
            match: (pathname: string) =>
              /\/school\/[^/]+\/review(?!\/oversight)(\/|$)/.test(pathname),
          },
        ]
      : []),
    ...(canOverseeReview
      ? [
          {
            href: wsHref(workspaceId, 'review/oversight'),
            icon: Gauge,
            labelKey: 'reviewOversight',
          },
        ]
      : []),
    {
      href: wsHref(workspaceId, 'content'),
      icon: BookOpen,
      labelKey: 'content',
      disabled: disabled('courses'),
    },
    {
      href: wsHref(workspaceId, 'groups'),
      icon: Layers,
      labelKey: 'groups',
      disabled: disabled('groups'),
      lockReason: 'Nav.locked.adminOnly',
    },
    {
      href: wsHref(workspaceId, 'students'),
      icon: Users,
      labelKey: 'students',
      disabled: disabled('students'),
      lockReason: 'Nav.locked.adminOnly',
    },
    {
      href: wsHref(workspaceId, 'teachers'),
      icon: GraduationCap,
      labelKey: 'teachers',
      disabled: disabled('teachers'),
      lockReason: 'Nav.locked.adminOnly',
    },
    ...(canSeeScheduling
      ? [
          {
            href: wsHref(workspaceId, 'scheduling'),
            icon: CalendarRange,
            labelKey: 'scheduling',
            disabled: disabled('scheduling'),
          },
        ]
      : []),
    {
      href: wsHref(workspaceId, 'invitations'),
      icon: MailCheck,
      labelKey: 'invitations',
      disabled: disabled('invitations'),
    },
    {
      href: wsHref(workspaceId, 'notifications'),
      icon: Bell,
      labelKey: 'notifications',
    },
  ];

  return [
    { items: mainItems },
    {
      items: [
        {
          href: wsHref(workspaceId, 'settings'),
          icon: Settings,
          labelKey: 'settings',
          disabled: disabled('settings'),
          lockReason: 'Nav.locked.adminOnly',
        },
      ],
    },
  ];
}

function buildTutorNav(workspaceId: string | undefined, review: ReviewNav = null): NavSection[] {
  // Nothing to point at until the workspace is known; the shell renders no items rather
  // than items that lead nowhere.
  if (!workspaceId) return [];

  return [
    {
      items: [
        { href: wsHref(workspaceId, 'dashboard'), icon: LayoutDashboard, labelKey: 'dashboard' },
        // No oversight twin beside it: a tutor is the only reviewer in their workspace,
        // and a screen showing their own load by name is a screen about one person.
        ...(review
          ? [
              {
                href: wsHref(workspaceId, 'review'),
                icon: SquareCheckBig,
                labelKey: 'review',
                badge: review.pending,
                badgeAlert: review.hasOverdue,
              },
            ]
          : []),
        { href: wsHref(workspaceId, 'students'), icon: Users, labelKey: 'students' },
        // The tutor's own week. The school's scheduling section is four screens about
        // cover, workload and forecast; this is one screen about the lessons they teach.
        { href: wsHref(workspaceId, 'schedule'), icon: CalendarDays, labelKey: 'schedule' },
        { href: wsHref(workspaceId, 'invitations'), icon: MailCheck, labelKey: 'invitations' },
        { href: wsHref(workspaceId, 'content'), icon: BookOpen, labelKey: 'content' },
      ],
    },
    {
      items: [{ href: wsHref(workspaceId, 'settings'), icon: Settings, labelKey: 'settings' }],
    },
  ];
}

function buildStudentNav(reviewsDue: number): NavSection[] {
  return [
    {
      items: [
        { href: '/student/home', icon: LayoutDashboard, labelKey: 'home' },
        { href: '/student/my-courses', icon: BookOpen, labelKey: 'myCourses' },
        { href: '/student/catalogue', icon: Search, labelKey: 'catalogue' },
        { href: '/student/training', icon: Zap, labelKey: 'training' },
        { href: '/student/reviews', icon: Bell, labelKey: 'reviews', badge: reviewsDue },
        { href: '/student/submissions', icon: ClipboardCheck, labelKey: 'submissions' },
        { href: '/student/progress', icon: BarChart3, labelKey: 'progress' },
      ],
    },
  ];
}

/** Student mobile bottom tab bar omits Progress, matching the design handoff. */
function buildStudentMobileNav(sections: NavSection[]): NavSection['items'] {
  return sections[0]?.items.filter((item) => item.labelKey !== 'progress') ?? [];
}

export type AppShellVariant = 'school' | 'student' | 'tutor';

type AppShellProps = {
  variant: AppShellVariant;
  user: CurrentUser;
  schoolContext?: SchoolContext;
  /**
   * The tutor's workspace id, for the badge on their marking inbox. The shell cannot read
   * it itself — it is a server call — and the count route takes a school slug or id.
   */
  tutorWorkspaceId?: string;
  children: React.ReactNode;
};

export function AppShell({
  variant,
  user,
  schoolContext,
  tutorWorkspaceId,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const params = useParams<{ workspaceId?: string; userId?: string }>();
  const workspaceSegment = params.workspaceId ?? '';
  const tNav = useTranslations('Nav');

  const { data: reviewsSummary } = useReviewsSummary({ enabled: variant === 'student' });

  // The badge, not the queue: one count for the whole school, refetched on focus and
  // invalidated by every verdict. The item appears only once the answer says this person
  // has something to mark — until then the shell cannot know, so it shows nothing rather
  // than an item that might turn out not to be theirs.
  const reviewCountFor =
    variant === 'school'
      ? workspaceSegment
      : variant === 'tutor'
        ? (tutorWorkspaceId ?? '')
        : '';
  const { data: reviewCount } = useReviewQueueCount(
    reviewCountFor,
    variant === 'school' || variant === 'tutor',
  );

  const sections: NavSection[] =
    variant === 'school'
      ? buildSchoolNav(
          workspaceSegment,
          schoolContext,
          reviewCount?.hasScope ? reviewCount : null,
        )
      : variant === 'tutor'
        ? buildTutorNav(
            tutorWorkspaceId ?? params.workspaceId,
            reviewCount?.hasScope ? reviewCount : null,
          )
        : buildStudentNav(reviewsSummary?.totalDue ?? 0);

  const userMenuExtraItems: UserMenuExtraItem[] | undefined =
    variant === 'student'
      ? [
          { href: '/student/notifications', icon: Bell, label: tNav('notifications') },
          { href: '/student/enrolled/requests', icon: Send, label: tNav('requests') },
          { href: '/student/settings', icon: Settings, label: tNav('settings') },
        ]
      : undefined;

  const activeContextKey =
    variant === 'school' && schoolContext
      ? `school:${schoolContext.schoolId}`
      : variant === 'tutor'
        ? 'private_tutor'
        : 'student';

  const showRoleBadge =
    variant === 'school' &&
    schoolContext?.schoolRole &&
    schoolContext.schoolRole !== 'OWNER' &&
    schoolContext.schoolRole !== 'ADMIN';

  const canSeeSchedulingAlerts =
    variant === 'school' &&
    !!schoolContext?.schoolRole &&
    SCHEDULING_SCHOOL_ROLES.has(schoolContext.schoolRole);

  const notificationsLinkContext: NotificationLinkContext =
    variant === 'school'
      ? { workspaceKind: 'school', workspaceId: schoolContext?.school.slug }
      : { workspaceKind: 'student' };

  const notificationsHref =
    variant === 'school' && schoolContext
      ? wsHref(schoolContext.school.slug, 'notifications')
      : variant === 'student'
        ? '/student/notifications'
        : undefined;

  const workspaceHeader = (collapsed: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <WorkspaceSwitcher activeContextKey={activeContextKey} collapsed={collapsed} />
      {!collapsed && showRoleBadge && <RoleBadge role={schoolContext!.schoolRole!} />}
    </div>
  );

  return (
    <TopbarSlotProvider>
      <div className="flex h-screen overflow-hidden bg-(--ssz-bg-base)">
        <Sidebar
          sections={sections}
          schoolType={variant === 'school' ? (schoolContext?.schoolType ?? 'online') : undefined}
          header={workspaceHeader}
        />
        <MobileSidebar
          sections={sections}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          header={workspaceHeader}
        />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Topbar
            user={user}
            onMenuOpen={() => setMobileOpen(true)}
            activeContextKey={activeContextKey}
            // The bar's middle is a slot a page can fill — the lesson editor puts its
            // breadcrumb there, the way the builder specs draw it. Nothing claims it on
            // most pages, and the search stub stays.
            search={<TopbarSlot fallback={variant === 'school' ? <GlobalSearchTrigger /> : null} />}
            userMenuExtraItems={userMenuExtraItems}
            actions={
              <div className="flex items-center gap-2">
                {variant === 'school' && <TrialPill />}
                {canSeeSchedulingAlerts && <AlertBadge schoolId={schoolContext?.schoolId} />}
                <NotificationBell
                  linkContext={notificationsLinkContext}
                  notificationsHref={notificationsHref}
                />
              </div>
            }
          />
          <main className={cn('flex-1 overflow-auto', variant === 'student' && 'pb-16 md:pb-0')}>
            {children}
          </main>
        </div>
        {variant === 'student' && <BottomTabBar items={buildStudentMobileNav(sections)} />}
      </div>
    </TopbarSlotProvider>
  );
}
