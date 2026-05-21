import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Topbar } from './topbar';

const meta = {
  title: 'Shared/Topbar',
  component: Topbar,
  parameters: { layout: 'fullscreen' },
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
