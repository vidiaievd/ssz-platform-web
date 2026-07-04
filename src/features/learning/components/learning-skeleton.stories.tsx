import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LearningSkeleton } from './learning-skeleton';

const meta = {
  title: 'Learning/LearningSkeleton',
  component: LearningSkeleton,
  decorators: [(Story) => <div className="max-w-sm p-4"><Story /></div>],
} satisfies Meta<typeof LearningSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  args: { variant: 'list', rows: 4 },
};

export const Card: Story = {
  args: { variant: 'card' },
};

export const Player: Story = {
  args: { variant: 'player' },
};

export const Text: Story = {
  args: { variant: 'text', rows: 5 },
};
