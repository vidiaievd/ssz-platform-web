import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Calendar, Repeat } from 'lucide-react';

import { ReminderCard } from './reminder-card';

const meta = {
  title: 'Student/Home/ReminderCard',
  component: ReminderCard,
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReminderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NextClass: Story = {
  args: {
    tone: 'info',
    icon: Calendar,
    overline: 'Next class',
    cta: 'View details',
    children: (
      <div>
        <p className="text-sm font-semibold text-(--ssz-text-primary)">Today · 17:00–18:30</p>
        <p className="mt-1 text-xs text-(--ssz-text-secondary)">Norsk B1 — Kveld · Room B2</p>
      </div>
    ),
  },
};

export const TimeToReview: Story = {
  args: {
    tone: 'amber',
    icon: Repeat,
    overline: 'Time to review',
    cta: 'Review now',
    children: (
      <p className="text-sm text-(--ssz-text-secondary)">44 cards are ready across 3 courses.</p>
    ),
  },
};

export const NoCta: Story = {
  args: {
    tone: 'primary',
    icon: Calendar,
    overline: 'Next class',
    children: (
      <p className="text-sm text-(--ssz-text-secondary)">No upcoming class scheduled yet.</p>
    ),
  },
};
