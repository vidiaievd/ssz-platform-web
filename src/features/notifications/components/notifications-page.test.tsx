import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { NotificationsResponse } from '../types';
import { NotificationsPage } from './notifications-page';

const push = vi.fn();
const searchParamsStore = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/school/greenwood/notifications',
  useSearchParams: () => searchParamsStore,
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

function mockListResponse(items: NotificationsResponse['items'], unreadCount = items.length) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items, unreadCount, nextCursor: null }),
    }),
  );
}

beforeEach(() => {
  push.mockClear();
  searchParamsStore.forEach((_v, k) => searchParamsStore.delete(k));
});

describe('NotificationsPage', () => {
  it('renders a rich ENROLLMENT_REQUEST row with the student name, not the raw enum', async () => {
    mockListResponse([ENROLLMENT_REQUEST]);

    renderWithProviders(<NotificationsPage linkContext={{ workspaceKind: 'school', schoolSlug: 'greenwood' }} locale="en" />);

    expect(await screen.findByText(/Maria Hansen/)).toBeInTheDocument();
    expect(screen.queryByText('ENROLLMENT_REQUEST')).not.toBeInTheDocument();
  });

  it('shows the per-tab empty state when there are no notifications', async () => {
    mockListResponse([]);

    renderWithProviders(<NotificationsPage linkContext={{ workspaceKind: 'student' }} locale="en" />);

    expect(await screen.findByText("You're all caught up!")).toBeInTheDocument();
  });

  it('navigates to the approvals screen when an actionable row is opened', async () => {
    mockListResponse([ENROLLMENT_REQUEST]);
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage linkContext={{ workspaceKind: 'school', schoolSlug: 'greenwood' }} locale="en" />);

    const row = await screen.findByRole('article', { name: /Maria Hansen/ });
    await user.click(within(row).getByText(/Maria Hansen/));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/school/greenwood/enrollment/requests'));
  });
});
