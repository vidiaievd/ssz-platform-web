import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../actions/update-school-profile', () => ({
  updateSchoolProfileAction: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock('../create/logo-uploader', () => ({
  LogoUploader: ({ onChange }: { onChange: (url: string) => void }) => (
    <button type="button" onClick={() => onChange('')}>
      remove logo
    </button>
  ),
}));
vi.mock('../../api/use-schools', () => ({
  useSchool: vi.fn(() => ({
    data: {
      id: 'sch1',
      name: 'Nordisk',
      description: 'Old',
      avatarUrl: 'https://cdn/x.png',
      website: 'https://nordisk.no',
      contactEmail: null,
      city: 'Oslo',
    },
    isPending: false,
    isError: false,
  })),
}));

const { SchoolProfileForm, profilePatch } = await import('./school-profile-form');
const { updateSchoolProfileAction } = await import('../../actions/update-school-profile');
const { toast } = await import('sonner');

function draw(canEdit = true) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SchoolProfileForm schoolId="sch1" canEdit={canEdit} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const base = { name: 'N', description: 'd', avatarUrl: 'a', website: 'w', contactEmail: '', city: 'c' };

describe('profilePatch', () => {
  it('sends only what changed, and a cleared optional field as null', () => {
    expect(profilePatch(base, { ...base })).toEqual({});
    expect(profilePatch(base, { ...base, name: ' New ', avatarUrl: '', website: ' ', contactEmail: 'a@b.no' })).toEqual({
      name: 'New',
      avatarUrl: null,
      website: null,
      contactEmail: 'a@b.no',
    });
    expect(profilePatch(base, { ...base, description: '' })).toEqual({ description: '' });
  });
});

describe('SchoolProfileForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the changed fields of the school', async () => {
    draw();
    fireEvent.change(screen.getByLabelText('School name'), { target: { value: 'Nordisk Språk' } });
    fireEvent.click(screen.getByRole('button', { name: 'remove logo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateSchoolProfileAction).toHaveBeenCalledWith('sch1', { name: 'Nordisk Språk', avatarUrl: null }),
    );
    expect(toast.success).toHaveBeenCalledWith(enMessages.Settings.school.saved);
  });

  it('refuses an empty name and a bad website before asking the server', async () => {
    draw();
    fireEvent.change(screen.getByLabelText('School name'), { target: { value: ' ' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'nordisk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(enMessages.Settings.school.errors.nameRequired)).toBeTruthy();
    expect(screen.getByText(enMessages.Settings.school.errors.website)).toBeTruthy();
    expect(updateSchoolProfileAction).not.toHaveBeenCalled();
  });

  it('keeps Save off until something changed', () => {
    draw();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('explains a read-only school instead of offering Save', () => {
    draw(false);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect((screen.getByLabelText('School name') as HTMLInputElement).closest('fieldset')?.disabled).toBe(true);
  });
});
