import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { LayoutDashboard, Settings } from 'lucide-react';

import { renderWithProviders } from '@/test/render';
import { useUiStore } from '@/stores/ui-store';
import { Sidebar } from './sidebar';
import type { NavSection } from './types';

vi.mock('@/lib/i18n/navigation', () => ({
  usePathname: () => '/school/dashboard',
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/school/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { href: '/school/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];

const SECTIONS_WITH_LOCKED: NavSection[] = [
  {
    items: [
      { href: '/school/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { href: '/school/settings', icon: Settings, labelKey: 'settings', disabled: true, lockReason: 'locked.adminOnly' },
    ],
  },
];

describe('Sidebar', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    localStorage.clear();
  });

  it('shows nav labels when expanded', () => {
    renderWithProviders(<Sidebar sections={SECTIONS} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks active item with aria-current="page"', () => {
    renderWithProviders(<Sidebar sections={SECTIONS} />);
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(settingsLink).not.toHaveAttribute('aria-current');
  });

  it('collapse button toggles sidebar state', () => {
    renderWithProviders(<Sidebar sections={SECTIONS} />);
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('hides labels when collapsed', () => {
    useUiStore.setState({ sidebarCollapsed: true });
    renderWithProviders(<Sidebar sections={SECTIONS} />);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders disabled item as aria-disabled span, not a link', () => {
    renderWithProviders(<Sidebar sections={SECTIONS_WITH_LOCKED} />);
    const settingsText = screen.getByText('Settings');
    // The disabled item renders as a span, not a link.
    const container = settingsText.closest('[aria-disabled="true"]');
    expect(container).toBeInTheDocument();
    expect(container?.tagName.toLowerCase()).not.toBe('a');
  });

  it('shows school-type pill for hybrid schools', () => {
    renderWithProviders(<Sidebar sections={SECTIONS} schoolType="hybrid" />);
    expect(screen.getByText('Hybrid')).toBeInTheDocument();
  });

  it('shows online pill for online schools', () => {
    renderWithProviders(<Sidebar sections={SECTIONS} schoolType="online" />);
    expect(screen.getByText('Online only')).toBeInTheDocument();
  });

  it('does not show school-type pill when schoolType is absent', () => {
    renderWithProviders(<Sidebar sections={SECTIONS} />);
    expect(screen.queryByText('Hybrid')).not.toBeInTheDocument();
    expect(screen.queryByText('Online only')).not.toBeInTheDocument();
  });

  it('collapse state persists across remounts', () => {
    const { unmount } = renderWithProviders(<Sidebar sections={SECTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    unmount();
    renderWithProviders(<Sidebar sections={SECTIONS} />);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});
