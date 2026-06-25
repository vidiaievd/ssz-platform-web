"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  Compass,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Library,
  MailCheck,
  School,
  Send,
  Settings,
  Users,
} from "lucide-react";

import type { CurrentUser } from "@/features/auth/types/current-user";
import type { DashboardRole, SchoolType } from "@/features/dashboard/types";
import type { SchoolRole } from "@/features/school/types";
import { navGating } from "@/features/dashboard/lib/roles";
import { NotificationBell } from "@/features/notifications";
import type { NotificationLinkContext } from "@/features/notifications";
import { WorkspaceSwitcher, RoleBadge } from "@/features/workspaces";
import { AlertBadge } from "./topbar/alert-badge";
import { GlobalSearchTrigger } from "./topbar/global-search-trigger";
import { TrialPill } from "./topbar/trial-pill";
import { Sidebar } from "./sidebar/sidebar";
import { MobileSidebar } from "./sidebar/mobile-sidebar";
import { Topbar } from "./topbar/topbar";
import type { NavSection } from "./sidebar/types";

export type SchoolContext = {
  role: DashboardRole;
  /** Original SchoolRole from org-service — used for role badge and page-level guards */
  schoolRole?: SchoolRole;
  schoolType: SchoolType;
  school: { name: string; slug: string };
  schoolId: string;
};

const SCHEDULING_SCHOOL_ROLES = new Set<SchoolRole>(['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER']);

function buildSchoolNav(schoolSlug: string, schoolCtx?: SchoolContext): NavSection[] {
  const gating = schoolCtx ? navGating(schoolCtx.role) : null;

  function disabled(navId: 'dashboard' | 'courses' | 'groups' | 'students' | 'teachers' | 'scheduling' | 'invitations' | 'settings'): boolean {
    return gating ? gating[navId] === 'locked' : false;
  }

  const canSeeScheduling =
    !!schoolCtx?.schoolRole &&
    SCHEDULING_SCHOOL_ROLES.has(schoolCtx.schoolRole);

  const mainItems = [
    {
      href: `/school/${schoolSlug}/dashboard`,
      icon: LayoutDashboard,
      labelKey: "dashboard",
      disabled: disabled('dashboard'),
      lockReason: "Nav.locked.ownerOnly",
    },
    {
      href: `/school/${schoolSlug}/content`,
      icon: BookOpen,
      labelKey: "content",
      disabled: disabled('courses'),
    },
    {
      href: `/school/${schoolSlug}/groups`,
      icon: Layers,
      labelKey: "groups",
      disabled: disabled('groups'),
      lockReason: "Nav.locked.adminOnly",
    },
    {
      href: `/school/${schoolSlug}/students`,
      icon: Users,
      labelKey: "students",
      disabled: disabled('students'),
      lockReason: "Nav.locked.adminOnly",
    },
    {
      href: `/school/${schoolSlug}/teachers`,
      icon: GraduationCap,
      labelKey: "teachers",
      disabled: disabled('teachers'),
      lockReason: "Nav.locked.adminOnly",
    },
    ...(canSeeScheduling
      ? [{
          href: `/school/${schoolSlug}/scheduling`,
          icon: CalendarRange,
          labelKey: "scheduling",
          disabled: disabled('scheduling'),
        }]
      : []),
    {
      href: `/school/${schoolSlug}/invitations`,
      icon: MailCheck,
      labelKey: "invitations",
      disabled: disabled('invitations'),
    },
  ];

  return [
    { items: mainItems },
    {
      items: [
        {
          href: `/school/${schoolSlug}/settings`,
          icon: Settings,
          labelKey: "settings",
          disabled: disabled('settings'),
          lockReason: "Nav.locked.adminOnly",
        },
      ],
    },
  ];
}

function buildTutorNav(userId: string): NavSection[] {
  return [
    {
      items: [
        { href: `/tutor/${userId}/dashboard`, icon: LayoutDashboard, labelKey: "dashboard" },
        { href: `/tutor/${userId}/students`, icon: Users, labelKey: "students" },
        { href: `/tutor/${userId}/invitations`, icon: MailCheck, labelKey: "invitations" },
        { href: `/tutor/${userId}/content`, icon: BookOpen, labelKey: "content" },
      ],
    },
    {
      items: [
        { href: `/tutor/${userId}/settings`, icon: Settings, labelKey: "settings" },
      ],
    },
  ];
}

const STUDENT_NAV: NavSection[] = [
  {
    items: [
      {
        href: "/student/dashboard",
        icon: LayoutDashboard,
        labelKey: "dashboard",
      },
      { href: "/student/discover", icon: Compass, labelKey: "discover" },
      { href: "/student/courses", icon: Library, labelKey: "courses" },
      { href: "/student/lessons", icon: BookOpen, labelKey: "lessons" },
      { href: "/student/enrolled", icon: School, labelKey: "mySchools" },
      { href: "/student/enrolled/requests", icon: Send, labelKey: "requests" },
    ],
  },
  {
    items: [
      { href: "/student/settings", icon: Settings, labelKey: "settings" },
    ],
  },
];

export type AppShellVariant = "school" | "student" | "tutor";

type AppShellProps = {
  variant: AppShellVariant;
  user: CurrentUser;
  schoolContext?: SchoolContext;
  /** Stable userId for the tutor workspace nav links */
  tutorUserId?: string;
  children: React.ReactNode;
};

export function AppShell({ variant, user, schoolContext, tutorUserId, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const params = useParams<{ schoolSlug?: string; userId?: string }>();

  const resolvedTutorId = tutorUserId ?? params.userId ?? user.userId ?? "";

  const sections: NavSection[] =
    variant === "school"
      ? buildSchoolNav(params.schoolSlug ?? "", schoolContext)
      : variant === "tutor"
        ? buildTutorNav(resolvedTutorId)
        : STUDENT_NAV;

  const activeContextKey =
    variant === "school" && schoolContext
      ? `school:${schoolContext.schoolId}`
      : variant === "tutor"
        ? "private_tutor"
        : "student";

  const showRoleBadge =
    variant === "school" &&
    schoolContext?.schoolRole &&
    schoolContext.schoolRole !== "OWNER" &&
    schoolContext.schoolRole !== "ADMIN";

  const canSeeSchedulingAlerts =
    variant === "school" &&
    !!schoolContext?.schoolRole &&
    SCHEDULING_SCHOOL_ROLES.has(schoolContext.schoolRole);

  const notificationsLinkContext: NotificationLinkContext =
    variant === "school"
      ? { workspaceKind: "school", schoolSlug: schoolContext?.school.slug }
      : { workspaceKind: "student" };

  const notificationsHref =
    variant === "school" && schoolContext
      ? `/school/${schoolContext.school.slug}/notifications`
      : variant === "student"
        ? "/student/notifications"
        : undefined;

  const workspaceHeader = (collapsed: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <WorkspaceSwitcher
        activeContextKey={activeContextKey}
        userId={resolvedTutorId || undefined}
        collapsed={collapsed}
      />
      {!collapsed && showRoleBadge && <RoleBadge role={schoolContext!.schoolRole!} />}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-(--ssz-bg-base)">
      <Sidebar
        sections={sections}
        schoolType={variant === "school" ? (schoolContext?.schoolType ?? "online") : undefined}
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
          search={variant === "school" ? <GlobalSearchTrigger /> : undefined}
          actions={
            <div className="flex items-center gap-2">
              {variant === "school" && <TrialPill />}
              {canSeeSchedulingAlerts && <AlertBadge schoolId={schoolContext?.schoolId} />}
              <NotificationBell
                linkContext={notificationsLinkContext}
                notificationsHref={notificationsHref}
              />
            </div>
          }
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
