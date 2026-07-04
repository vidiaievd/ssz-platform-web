import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { vi } from 'vitest';

// `resendVerificationAction` is a real server action module that reads
// server-only env vars at module scope — fine under Next's RSC build, not
// under plain Vite bundling for Storybook/vitest-browser.
vi.mock('../actions/verify-email', () => ({
  resendVerificationAction: vi.fn(),
}));

import { CheckEmailScreen } from './check-email-screen';

const meta = {
  title: 'Auth/CheckEmailScreen',
  component: CheckEmailScreen,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CheckEmailScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
