import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { GroupsWidget } from './groups-widget';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe('GroupsWidget, no groups', () => {
  it('offers an admin a new group', () => {
    renderWithProviders(<GroupsWidget groupsHealth={{ status: 'empty' }} role="owner" workspaceId="w" />);
    expect(screen.getByRole('link', { name: 'New group' })).toBeInTheDocument();
  });

  it('tells a teacher no group is assigned, without a button they cannot use', () => {
    renderWithProviders(<GroupsWidget groupsHealth={{ status: 'empty' }} role="teacher" workspaceId="w" />);
    expect(screen.getByText('You have not been assigned to a group yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New group' })).not.toBeInTheDocument();
  });
});
