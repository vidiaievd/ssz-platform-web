import { Layers } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from '@/components/ui/button';

import { EmptyState } from './empty-state';

const meta = {
  title: 'Learning/EmptyState',
  component: EmptyState,
  decorators: [(Story) => <div className="max-w-sm p-4"><Story /></div>],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'Nothing here yet.' },
};

export const WithDescription: Story = {
  args: {
    title: 'No vocabulary to review',
    description: 'Complete your first lesson and words will appear here.',
  },
};

export const WithAction: Story = {
  args: { title: 'No courses yet' },
  render: () => (
    <EmptyState
      title="No courses yet"
      description="Discover courses and start learning at your own pace."
      action={<Button variant="primary" size="sm">Discover courses</Button>}
    />
  ),
};

export const CustomIcon: Story = {
  args: {
    icon: Layers,
    title: 'No units in this course',
    description: "The author hasn't added any units yet.",
  },
};
