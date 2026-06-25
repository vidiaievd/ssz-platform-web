import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NotificationListItem } from './notification-list-item';
import type { Notification } from '../types';

const SCHOOL_CONTEXT = { workspaceKind: 'school' as const, schoolSlug: 'greenwood' };

const noop = () => {};

const ENROLLMENT_REQUEST: Notification = {
  id: 'n1',
  type: 'ENROLLMENT_REQUEST',
  templateData: {
    membershipId: 'm1',
    schoolId: 's1',
    schoolName: 'Greenwood School',
    studentId: 'u1',
    studentName: 'Maria Hansen',
    source: 'public-apply',
    occurredAt: new Date().toISOString(),
  },
  isRead: false,
  createdAt: new Date().toISOString(),
};

const TEACHER_PROFILE_CHANGED: Notification = {
  id: 'n2',
  type: 'TEACHER_PROFILE_CHANGED',
  templateData: {
    teacherUserId: 't1',
    changedFields: ['bio'],
    schoolId: 's1',
    occurredAt: new Date().toISOString(),
  },
  isRead: true,
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
};

const ARCHIVED: Notification = {
  ...TEACHER_PROFILE_CHANGED,
  id: 'n3',
  archivedAt: new Date().toISOString(),
};

const meta = {
  title: 'Notifications/NotificationListItem',
  component: NotificationListItem,
  parameters: { nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      const client = new QueryClient();
      return (
        <QueryClientProvider client={client}>
          <div className="max-w-150 rounded-lg border border-border">
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  args: {
    variant: 'list',
    linkContext: SCHOOL_CONTEXT,
    onOpen: noop,
    onMarkRead: noop,
    onMarkUnread: noop,
    onArchive: noop,
    onUnarchive: noop,
    onDelete: noop,
  },
} satisfies Meta<typeof NotificationListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActionableUnread: Story = {
  args: { notification: ENROLLMENT_REQUEST },
};

export const InformationalRead: Story = {
  args: { notification: TEACHER_PROFILE_CHANGED },
};

export const Archived: Story = {
  args: { notification: ARCHIVED },
};

export const DropdownVariant: Story = {
  args: { notification: ENROLLMENT_REQUEST, variant: 'dropdown' },
};
