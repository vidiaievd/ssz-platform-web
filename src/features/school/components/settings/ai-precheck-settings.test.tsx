import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';
import { enMessages } from '@/lib/i18n/messages';

import type { AiPrecheckSettings } from '../../types/ai-precheck';
import { AiPrecheckSettingsForm } from './ai-precheck-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn();

function entitlements(keys: string[]): Entitlements {
  return {
    account: { type: 'workspace', externalId: 'school-1' },
    features: Object.fromEntries(
      keys.map((key) => [key, { enabled: true, monthlyCredits: null, limits: {} }]),
    ),
    validUntil: '2099-01-01T00:00:00.000Z',
    version: 1,
  };
}

function renderForm({ keys = ['ai.practice'], canEdit = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EntitlementsProvider entitlements={entitlements(keys)}>
          <AiPrecheckSettingsForm school="nordick" canEdit={canEdit} />
        </EntitlementsProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function answer(settings: AiPrecheckSettings, onPut?: { status: number; body: unknown }) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (onPut) return { ok: false, status: onPut.status, json: async () => onPut.body };
      return { ok: true, json: async () => JSON.parse(String(init.body)) };
    }
    return { ok: true, json: async () => settings };
  });
}

function sentBody(): unknown {
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
  return put ? JSON.parse(String(put[1].body)) : undefined;
}

const OFF: AiPrecheckSettings = {
  enabled: false,
  perExerciseLimit: 3,
  perLearnerMonthlyCredits: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('AiPrecheckSettingsForm', () => {
  it('draws nothing where the plan has no ai.practice', () => {
    answer(OFF);
    const { container } = renderForm({ keys: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the saved settings, an empty field meaning no limit', async () => {
    answer(OFF);
    renderForm();
    expect(await screen.findByLabelText(/Checks per student and exercise/)).toHaveValue('3');
    expect(screen.getByLabelText(/Credits per student a month/)).toHaveValue('');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the switch and both limits, an emptied field as null', async () => {
    answer(OFF);
    renderForm();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox'));
    await user.clear(screen.getByLabelText(/Checks per student and exercise/));
    await user.type(screen.getByLabelText(/Credits per student a month/), '40');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sentBody()).toEqual({
      enabled: true,
      perExerciseLimit: null,
      perLearnerMonthlyCredits: 40,
    });
  });

  it('flags a value out of range and does not send it', async () => {
    answer(OFF);
    renderForm();
    const user = userEvent.setup();
    const field = await screen.findByLabelText(/Checks per student and exercise/);
    await user.clear(field);
    await user.type(field, '0');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('warns that nothing but the plan stops a check when both limits are empty', async () => {
    answer({ enabled: true, perExerciseLimit: null, perLearnerMonthlyCredits: null });
    renderForm();
    expect(await screen.findByText(/only the plan's credits stop the checks/)).toBeInTheDocument();
  });

  it('names the plan when the service refuses to turn it on', async () => {
    answer(OFF, { status: 403, body: { error: 'not_entitled' } });
    renderForm();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('does not include')),
    );
  });

  it('is read-only for someone who cannot edit', async () => {
    answer(OFF);
    renderForm({ canEdit: false });
    expect(await screen.findByRole('checkbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
