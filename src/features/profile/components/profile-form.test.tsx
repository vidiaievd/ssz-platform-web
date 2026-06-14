import { http, HttpResponse } from 'msw';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { ProfileForm } from './profile-form';

const PROFILE = {
  id: '1',
  userId: 'u1',
  handle: null,
  displayName: 'Jane Doe',
  firstName: null,
  lastName: null,
  bio: 'I teach Norwegian.',
  avatarUrl: null,
  uiLocale: 'en',
  instructionLocales: ['nb'],
  timezone: 'Europe/Oslo',
  contactEmail: null,
  contactPhone: null,
  hasStudentProfile: false,
  hasTutorProfile: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

vi.mock('../api/update-profile', () => ({
  updateProfileAction: vi.fn(),
}));

// Radix Select has side effects (ResizeObserver, portals) that interfere with
// RHF field registration in JSDOM — replace with simple native selects.
// vi.mock factories are hoisted above imports so we must use require().
/* eslint-disable @typescript-eslint/no-require-imports */
vi.mock('./locale-select', () => ({
  LocaleSelect: ({ control }: { control: unknown }) => {
    const { field } = require('react-hook-form').useController({ name: 'uiLocale', control });
    return <select data-testid="locale-select" {...field} />;
  },
}));
vi.mock('./timezone-select', () => ({
  TimezoneSelect: ({ control }: { control: unknown }) => {
    const { field } = require('react-hook-form').useController({ name: 'timezone', control });
    return <select data-testid="timezone-select" {...field} />;
  },
}));
/* eslint-enable @typescript-eslint/no-require-imports */

async function setupWithProfile() {
  server.use(
    http.get('/api/profile/me', () => HttpResponse.json(PROFILE)),
  );

  const { updateProfileAction } = await import('../api/update-profile');
  return { updateProfileAction: vi.mocked(updateProfileAction) };
}

describe('ProfileForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', () => {
    server.use(http.get('/api/profile/me', () => new Promise(() => undefined)));
    renderWithProviders(<ProfileForm />);
    expect(document.querySelector('[data-slot="skeleton"]') ?? document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('populates fields from the loaded profile', async () => {
    await setupWithProfile();
    renderWithProviders(<ProfileForm />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('I teach Norwegian.')).toBeInTheDocument();
  });

  it('shows validation error when display name is cleared', async () => {
    const { updateProfileAction } = await setupWithProfile();
    renderWithProviders(<ProfileForm />);

    await waitFor(() => screen.getByDisplayValue('Jane Doe'));

    const nameInput = screen.getByLabelText(/display name/i);
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    expect(updateProfileAction).not.toHaveBeenCalled();
  });

  it('calls updateProfileAction when submitted with valid data', async () => {
    const { updateProfileAction } = await setupWithProfile();
    updateProfileAction.mockResolvedValue({ ok: true, value: PROFILE });

    renderWithProviders(<ProfileForm />);

    // Wait for the form to populate from the API response
    await waitFor(() => screen.getByDisplayValue('Jane Doe'));

    // Fire submit directly on the form element to bypass button-interaction quirks in JSDOM
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(updateProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Jane Doe' }),
      );
    });
  });
});
