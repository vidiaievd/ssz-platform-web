'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  BookOpen,
  Compass,
  LayoutDashboard,
  School,
  Send,
  Settings,
  Users,
} from 'lucide-react';

import type { CurrentUser } from '@/features/auth/types/current-user';
import { NotificationBell } from '@/features/notifications';
import { Sidebar } from './sidebar/sidebar';
import { MobileSidebar } from './sidebar/mobile-sidebar';
import { Topbar } from './topbar/topbar';
import type { NavSection } from './sidebar/types';

function buildSchoolNav(schoolId: string): NavSection[] {
  return [
    {
      items: [
        { href: `/school/${schoolId}/dashboard`, icon: LayoutDashboard, labelKey: 'dashboard' },
        { href: `/school/${schoolId}/students`, icon: Users, labelKey: 'students' },
        { href: `/school/${schoolId}/content`, icon: BookOpen, labelKey: 'content' },
      ],
    },
    {
      items: [
        { href: `/school/${schoolId}/settings`, icon: Settings, labelKey: 'settings' },
      ],
    },
  ];
}

const STUDENT_NAV: NavSection[] = [
  {
    items: [
      { href: '/student/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { href: '/student/discover', icon: Compass, labelKey: 'discover' },
      { href: '/student/lessons', icon: BookOpen, labelKey: 'lessons' },
      { href: '/student/enrolled', icon: School, labelKey: 'mySchools' },
      { href: '/student/enrolled/requests', icon: Send, labelKey: 'requests' },
    ],
  },
  {
    items: [
      { href: '/student/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];

export type AppShellVariant = 'school' | 'student';

type AppShellProps = {
  variant: AppShellVariant;
  user: CurrentUser;
  children: React.ReactNode;
};

export function AppShell({ variant, user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const params = useParams<{ schoolId?: string }>();

  const sections: NavSection[] =
    variant === 'school'
      ? buildSchoolNav(params.schoolId ?? '')
      : STUDENT_NAV;

  return (
    <div className="flex h-screen overflow-hidden bg-(--ssz-bg-base)">
      <Sidebar sections={sections} />
      <MobileSidebar
        sections={sections}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar
          user={user}
          onMenuOpen={() => setMobileOpen(true)}
          actions={variant === 'student' ? <NotificationBell /> : undefined}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
