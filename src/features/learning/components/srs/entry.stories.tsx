import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SrsEntry } from './entry';

const meta = {
  title: 'Learning/SrsEntry',
  component: SrsEntry,
} satisfies Meta<typeof SrsEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Due: Story = {
  args: { dueCount: 12, reviewedToday: 8, dailyLimit: 200, onStart: () => {} },
};

/**
 * The day's quota is met. The screen offers rather than refuses: finishing is the
 * primary action, carrying on the secondary one — and both are reachable by keyboard,
 * which the disabled button this replaced was not.
 */
export const QuotaMet: Story = {
  args: { dueCount: 12, reviewedToday: 200, dailyLimit: 200, onStart: () => {} },
};

export const CaughtUp: Story = {
  args: { dueCount: 0, reviewedToday: 40, dailyLimit: 200, onStart: () => {} },
};
