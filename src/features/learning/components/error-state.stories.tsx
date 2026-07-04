import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ErrorState } from './error-state';

const meta = {
  title: 'Learning/ErrorState',
  component: ErrorState,
  decorators: [(Story) => <div className="max-w-sm p-4"><Story /></div>],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithRetry: Story = {
  args: { onRetry: () => alert('Retry clicked') },
};

export const CustomMessage: Story = {
  args: {
    title: "Couldn't load exercises",
    description: 'Check your connection and try again.',
    onRetry: () => alert('Retry clicked'),
  },
};
