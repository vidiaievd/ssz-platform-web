import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CadenceCard } from './cadence-card';

const meta = {
  title: 'Student/Home/CadenceCard',
  component: CadenceCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CadenceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Current shipped shape: no activity log yet, so only today's count renders. */
export const ReviewedSomeToday: Story = {
  args: { reviewedToday: 12 },
};

export const NoneToday: Story = {
  args: { reviewedToday: 0 },
};

/**
 * Once an activity-log endpoint exists, a caller can pass `sessions` and the
 * dot row appears with no changes to this component.
 */
export const WithActivityRow: Story = {
  args: {
    reviewedToday: 8,
    sessions: [
      { label: 'Mon', active: true },
      { label: 'Tue', active: false, isToday: true },
      { label: 'Wed', active: false },
      { label: 'Thu', active: false },
      { label: 'Fri', active: false },
      { label: 'Sat', active: true },
      { label: 'Sun', active: false },
    ],
  },
};
