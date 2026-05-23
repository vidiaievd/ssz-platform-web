'use client';

import { useState } from 'react';
import {
  BookOpen,
  Compass,
  LayoutDashboard,
  School,
  Settings,
  Users,
} from 'lucide-react';

import type { CurrentUser } from '@/features/auth/types/current-user';
import { Sidebar } from './sidebar/sidebar';
import { MobileSidebar } from './sidebar/mobile-sidebar';
import { Topbar } from './topbar/topbar';
import type { NavSection } from './sidebar/types';

const SCHOOL_NAV: NavSection[] = [
  {
    items: [
      { href: '/school/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { href: '/school/students', icon: Users, labelKey: 'students' },
      { href: '/school/content', icon: BookOpen, labelKey: 'content' },
    ],
  },
  {
    items: [
      { href: '/school/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];

const STUDENT_NAV: NavSection[] = [
  {
    items: [
      { href: '/student/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { href: '/student/discover', icon: Compass, labelKey: 'discover' },
      { href: '/student/lessons', icon: BookOpen, labelKey: 'lessons' },
      { href: '/student/enrolled', icon: School, labelKey: 'mySchools' },
    ],
  },
  {
    items: [
      { href: '/student/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];

const NAV_CONFIGS = { school: SCHOOL_NAV, student: STUDENT_NAV } as const;

export type AppShellVariant = keyof typeof NAV_CONFIGS;

type AppShellProps = {
  variant: AppShellVariant;
  user: CurrentUser;
  children: React.ReactNode;
};

export function AppShell({ variant, user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = NAV_CONFIGS[variant];

  return (
    <div className="flex h-screen overflow-hidden bg-(--ssz-bg-base)">
      <Sidebar sections={sections} />
      <MobileSidebar
        sections={sections}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar user={user} onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
