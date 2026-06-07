import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StatusChip } from './status-chip';
import type { StudentStatus } from '@/features/students/types';

const ALL_STATUSES: StudentStatus[] = [
  'active',
  'at-risk',
  'new',
  'finished',
  'clash',
  'unassigned',
];

const meta: Meta<typeof StatusChip> = {
  title: 'Students/StatusChip',
  component: StatusChip,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof StatusChip>;

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL_STATUSES.map((s) => (
        <StatusChip key={s} status={s} />
      ))}
    </div>
  ),
};

export const Active: Story = { args: { status: 'active' } };
export const AtRisk: Story = { args: { status: 'at-risk' } };
export const New: Story = { args: { status: 'new' } };
export const Finished: Story = { args: { status: 'finished' } };
export const Clash: Story = { args: { status: 'clash' } };
export const Unassigned: Story = { args: { status: 'unassigned' } };
