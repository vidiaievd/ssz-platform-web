import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { NotificationBell } from './notification-bell';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const ENROLLMENT_REQUEST = {
  id: 'n1',
  type: 'ENROLLMENT_REQUEST' as const,
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

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [ENROLLMENT_REQUEST], unreadCount: 1, nextCursor: null }),
    }),
  );
});

describe('NotificationBell', () => {
  it('shows the unread count badge and a rich preview row', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <NotificationBell
        linkContext={{ workspaceKind: 'school', schoolSlug: 'greenwood' }}
        notificationsHref="/school/greenwood/notifications"
      />,
    );

    expect(await screen.findByLabelText('1 unread notification')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 unread notification' }));

    expect(await screen.findByText(/Maria Hansen/)).toBeInTheDocument();
  });

  it('navigates to the notifications page via "Open all" and closes the popover', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <NotificationBell
        linkContext={{ workspaceKind: 'school', schoolSlug: 'greenwood' }}
        notificationsHref="/school/greenwood/notifications"
      />,
    );

    await user.click(await screen.findByRole('button', { name: '1 unread notification' }));
    await user.click(await screen.findByRole('button', { name: 'Open all' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/school/greenwood/notifications'));
  });
});
