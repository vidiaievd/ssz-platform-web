import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';
import { enMessages } from '@/lib/i18n/messages';

import { SlaSettings } from './sla-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn();

const noKeys: Entitlements = {
  account: { type: 'workspace', externalId: 'school-1' },
  subscription: null,
  features: {},
  validUntil: '2099-01-01T00:00:00.000Z',
  version: 1,
};

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EntitlementsProvider entitlements={noKeys}>
          <SlaSettings school="nordick" canEdit />
        </EntitlementsProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ respondWithinHours: 48, escalateAfterHours: 72, escalateTo: 'school_admins' }),
  }));
});

/**
 * A group with no lead teacher goes to the school's administrators (OQ-13). The school
 * should read that under the field when it picks the lead-teacher target, not find out
 * from a letter it did not expect.
 */
describe('SlaSettings — escalation target', () => {
  it('tells the school where a group without a lead teacher goes', async () => {
    renderSettings();
    const select = await screen.findByRole('combobox', { name: 'Escalate to' });

    expect(screen.queryByText(/A group with no lead teacher/)).not.toBeInTheDocument();

    await userEvent.selectOptions(select, 'primary_teacher');

    expect(
      screen.getByText(/A group with no lead teacher goes to the school administrators/),
    ).toBeInTheDocument();
  });
});
