import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LayoutDashboard, BookOpen, Settings, Users } from 'lucide-react';

import { Sidebar } from './sidebar';
import type { NavSection } from './types';

const DEMO_SECTIONS: NavSection[] = [
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

const meta = {
  title: 'Shared/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-screen">
        <Story />
        <div className="flex-1 bg-background p-6">
          <p className="text-sm text-muted-foreground">Main content area</p>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: { sections: DEMO_SECTIONS },
};

export const Collapsed: Story = {
  args: { sections: DEMO_SECTIONS },
  play: async () => {
    const { useUiStore } = await import('@/stores/ui-store');
    useUiStore.setState({ sidebarCollapsed: true });
  },
};
