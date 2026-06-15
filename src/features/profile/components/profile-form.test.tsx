import { http, HttpResponse } from 'msw';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { ProfileForm } from './profile-form';
import { ProfileSettingsFormProvider } from '../hooks/use-profile-settings-form';

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

const TUTOR = {
  id: 't1',
  userId: 'u1',
  teachingLanguages: [],
  hourlyRate: null,
  currency: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

vi.mock('../api/update-profile', () => ({
  updateProfileAction: vi.fn(),
}));

// Radix Select has side effects (ResizeObserver, portals) that interfere with
// RHF field registration in JSDOM — replace with simple native selects.
/* eslint-disable @typescript-eslint/no-require-imports */
vi.mock('./timezone-select', () => ({
  TimezoneSelect: ({ control }: { control: unknown }) => {
    const { field } = require('react-hook-form').useController({ name: 'timezone', control });
    return <select data-testid="timezone-select" {...field} />;
  },
}));
/* eslint-enable @typescript-eslint/no-require-imports */

function renderForm() {
  return renderWithProviders(
    <ProfileSettingsFormProvider isPrivateTutor={false}>
      <ProfileForm />
    </ProfileSettingsFormProvider>,
  );
}

async function setupWithProfile() {
  server.use(
    http.get('/api/profile/me', () => HttpResponse.json(PROFILE)),
    http.get('/api/profile/tutor/me', () => HttpResponse.json(TUTOR)),
  );

  const { updateProfileAction } = await import('../api/update-profile');
  return { updateProfileAction: vi.mocked(updateProfileAction) };
}

describe('ProfileForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', () => {
    server.use(http.get('/api/profile/me', () => new Promise(() => undefined)));
    renderForm();
    expect(document.querySelector('[data-slot="skeleton"]') ?? document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('populates fields from the loaded profile', async () => {
    await setupWithProfile();
    renderForm();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('I teach Norwegian.')).toBeInTheDocument();
  });

  it('shows validation error when display name is cleared', async () => {
    const { updateProfileAction } = await setupWithProfile();
    renderForm();

    await waitFor(() => screen.getByDisplayValue('Jane Doe'));

    const nameInput = screen.getByLabelText(/display name/i);
    await userEvent.clear(nameInput);
    // Submit the form directly to trigger validation (save bar only shows when dirty)
    fireEvent.submit(document.querySelector('form[data-profile-form]')!);

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    expect(updateProfileAction).not.toHaveBeenCalled();
  });

  it('calls updateProfileAction when submitted with valid data', async () => {
    const { updateProfileAction } = await setupWithProfile();
    updateProfileAction.mockResolvedValue({ ok: true, value: PROFILE });

    renderForm();

    await waitFor(() => screen.getByDisplayValue('Jane Doe'));

    fireEvent.submit(document.querySelector('form[data-profile-form]')!);

    await waitFor(() => {
      expect(updateProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Jane Doe' }),
      );
    });
  });
});
