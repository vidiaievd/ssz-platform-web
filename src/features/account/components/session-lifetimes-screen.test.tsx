import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { TokenLifetimes } from '../types/token-lifetimes';
import { SessionLifetimesScreen } from './session-lifetimes-screen';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        <SessionLifetimesScreen />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const fetchMock = vi.fn();

const policy = (role: string, clientType: 'web' | 'mobile', hours: number) => ({
  role,
  clientType,
  refreshLifetimeHours: hours,
  updatedAt: '2026-10-16T12:00:00Z',
  updatedBy: null,
});

const lifetimes: TokenLifetimes = {
  policies: [
    policy('student', 'mobile', 720),
    policy('student', 'web', 168),
    policy('platform_admin', 'mobile', 12),
    policy('platform_admin', 'web', 12),
  ],
  fallbackHours: 168,
  minHours: 1,
  maxHours: 2160,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => lifetimes });
});

describe('SessionLifetimesScreen', () => {
  it('lists the most privileged role first, with each lifetime in days or hours', async () => {
    renderScreen();

    const rows = await screen.findAllByRole('row');
    expect(rows[1]).toHaveTextContent('Platform administrator');
    expect(rows[2]).toHaveTextContent('Student');
    expect(screen.getByLabelText('Student — Mobile app')).toHaveValue(720);
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getAllByText('12 hours')).toHaveLength(2);
  });

  it('sends only the cell that changed', async () => {
    renderScreen();

    const field = await screen.findByLabelText('Student — Web');
    await userEvent.clear(field);
    await userEvent.type(field, '72');
    expect(screen.getByText('3 days · was 7 days')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/token-lifetimes',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(init.body)).toEqual({
      policies: [{ role: 'student', clientType: 'web', refreshLifetimeHours: 72 }],
    });
  });

  it('refuses a number outside the bounds before the round trip', async () => {
    renderScreen();

    const field = await screen.findByLabelText('Platform administrator — Web');
    await userEvent.clear(field);
    await userEvent.type(field, '5000');

    expect(screen.getByText('Between 1 and 2160 hours.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps Save off until something changes', async () => {
    renderScreen();

    await screen.findByLabelText('Student — Web');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Nothing has been changed since the defaults were set.')).toBeInTheDocument();
  });
});
