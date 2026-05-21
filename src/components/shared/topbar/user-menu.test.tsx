import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { UserMenu } from './user-menu';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/auth/components/logout-button', () => ({
  LogoutButton: ({ children }: { children?: React.ReactNode }) => (
    <button data-testid="logout-btn">{children ?? 'Sign out'}</button>
  ),
}));

describe('UserMenu', () => {
  it('shows School role label for school user', async () => {
    renderWithProviders(<UserMenu user={{ roles: ['school'] }} />);
    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByText('School')).toBeInTheDocument();
  });

  it('shows Tutor role label for tutor user', async () => {
    renderWithProviders(<UserMenu user={{ roles: ['tutor'] }} />);
    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByText('Tutor')).toBeInTheDocument();
  });

  it('shows Student role label for student user', async () => {
    renderWithProviders(<UserMenu user={{ roles: ['student'] }} />);
    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it('renders settings and sign out items when open', async () => {
    renderWithProviders(<UserMenu user={{ roles: ['school'] }} />);
    await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
  });
});
