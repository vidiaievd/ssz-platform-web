import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// LogoutButton imports the real `logoutAction` server action module, which
// reads server-only env vars at module scope — fine under Next's RSC build
// (which strips it to an RPC stub for client bundles), but not under plain
// Vite bundling for Storybook/vitest-browser.
vi.mock('@/features/auth/components/logout-button', () => ({
  LogoutButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children ?? 'Sign out'}</button>
  ),
}));

import { Topbar } from './topbar';

const meta = {
  title: 'Shared/Topbar',
  component: Topbar,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      const client = new QueryClient();
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof Topbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  onMenuOpen: () => {},
  user: { roles: ['school'] },
};

export const School: Story = {
  args: { ...baseArgs, user: { roles: ['school'] } },
};

export const Tutor: Story = {
  args: { ...baseArgs, user: { roles: ['tutor'] } },
};

export const Student: Story = {
  args: { ...baseArgs, user: { roles: ['student'] } },
};
