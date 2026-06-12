"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  Compass,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MailCheck,
  School,
  Send,
  Settings,
  Users,
} from "lucide-react";

import type { CurrentUser } from "@/features/auth/types/current-user";
import type { DashboardRole, SchoolType } from "@/features/dashboard/types";
import { navGating } from "@/features/dashboard/lib/roles";
import { NotificationBell } from "@/features/notifications";
import { WorkspaceSwitcher } from "@/features/workspaces";
import { AlertBadge } from "./topbar/alert-badge";
import { Sidebar } from "./sidebar/sidebar";
import { MobileSidebar } from "./sidebar/mobile-sidebar";
import { Topbar } from "./topbar/topbar";
import type { NavSection } from "./sidebar/types";

export type SchoolContext = {
  role: DashboardRole;
  schoolType: SchoolType;
  school: { name: string; slug: string };
  schoolId: string;
};

function buildSchoolNav(schoolSlug: string, schoolCtx?: SchoolContext): NavSection[] {
  const gating = schoolCtx ? navGating(schoolCtx.role) : null;

  function disabled(navId: 'dashboard' | 'courses' | 'groups' | 'students' | 'teachers' | 'invitations' | 'settings'): boolean {
    return gating ? gating[navId] === 'locked' : false;
  }

  return [
    {
      items: [
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
        {
          href: `/school/${schoolSlug}/invitations`,
          icon: MailCheck,
          labelKey: "invitations",
          disabled: disabled('invitations'),
        },
      ],
    },
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

  const workspaceSwitcher = (
    <WorkspaceSwitcher activeContextKey={activeContextKey} userId={resolvedTutorId || undefined} />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-(--ssz-bg-base)">
      <Sidebar
        sections={sections}
        schoolType={variant === "school" ? (schoolContext?.schoolType ?? "online") : undefined}
      />
      <MobileSidebar
        sections={sections}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar
          user={user}
          onMenuOpen={() => setMobileOpen(true)}
          leading={workspaceSwitcher}
          actions={
            variant === "student" ? (
              <NotificationBell />
            ) : variant === "school" ? (
              <AlertBadge schoolId={schoolContext?.schoolId} />
            ) : undefined
          }
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
