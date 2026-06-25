import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { WeeklySchedule } from './weekly-schedule';

const meta = {
  title: 'Student/WeeklySchedule',
  component: WeeklySchedule,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof WeeklySchedule>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { schedule: [] },
};

export const WithSlots: Story = {
  args: {
    schedule: [
      { day: 'Tue', start: '18:00', end: '19:30', room: 'Room B2' },
      { day: 'Thu', start: '18:00', end: '19:30', room: 'Room B2' },
    ],
  },
};
