import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ProgressBadge } from './progress-badge';

const meta = {
  title: 'Learning/ProgressBadge',
  component: ProgressBadge,
  decorators: [(Story) => <div className="p-4"><Story /></div>],
} satisfies Meta<typeof ProgressBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Started: Story = {
  args: { done: 3, total: 10, label: 'lessons' },
};

export const HalfDone: Story = {
  args: { done: 5, total: 10 },
};

export const Complete: Story = {
  args: { done: 10, total: 10, label: 'lessons' },
};

export const Empty: Story = {
  args: { done: 0, total: 8, label: 'exercises' },
};

export const Small: Story = {
  args: { done: 2, total: 6, size: 'sm' },
};
