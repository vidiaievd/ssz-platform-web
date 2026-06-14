import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InvitationStatusChip } from './invitation-status-chip';
import type { InvitationStatus } from '@/features/invitations/types';

const ALL_STATUSES: InvitationStatus[] = ['accepted', 'pending', 'expired', 'revoked'];

const meta: Meta<typeof InvitationStatusChip> = {
  title: 'Invitations/StatusChip',
  component: InvitationStatusChip,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof InvitationStatusChip>;

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL_STATUSES.map((s) => (
        <InvitationStatusChip key={s} status={s} />
      ))}
    </div>
  ),
};

export const Accepted: Story = { args: { status: 'accepted' } };
export const Pending: Story = { args: { status: 'pending' } };
export const Expired: Story = { args: { status: 'expired' } };
export const Revoked: Story = { args: { status: 'revoked' } };
