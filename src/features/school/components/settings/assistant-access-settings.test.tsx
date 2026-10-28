import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';
import { enMessages } from '@/lib/i18n/messages';

import type { AssistantAccess, AssistantAccessChoices } from '../../types/assistant-access';
import { AssistantAccessSettings } from './assistant-access-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();

const CHOICES: AssistantAccessChoices = {
  groups: [
    { id: 'g-1', name: 'A2 evening', studentCount: 6 },
    { id: 'g-2', name: 'B1 morning', studentCount: 1 },
  ],
  students: [
    { userId: 'u-1', name: 'Ola Nordmann', email: 'ola@example.com' },
    { userId: 'u-2', name: 'Kari Nordmann', email: 'kari@example.com' },
  ],
};

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

function renderSettings({ keys = ['ai.student_assist'], canEdit = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EntitlementsProvider entitlements={entitlements(keys)}>
          <AssistantAccessSettings school="nordick" choices={CHOICES} canEdit={canEdit} />
        </EntitlementsProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** The saved choice on GET; a PUT answers with `onPut`, or echoes what it was sent. */
function answer(access: AssistantAccess, onPut?: { status: number; body: unknown }) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (onPut) return { ok: false, status: onPut.status, json: async () => onPut.body };
      return { ok: true, json: async () => JSON.parse(String(init.body)) };
    }
    return { ok: true, json: async () => access };
  });
}

function sentBody(): unknown {
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
  return put ? JSON.parse(String(put[1].body)) : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('AssistantAccessSettings', () => {
  it('draws nothing where the plan has no assistant for students', async () => {
    answer({ mode: 'all_students', groupIds: [], studentIds: [] });
    const { container } = renderSettings({ keys: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the groups only for the group mode and the students only for theirs', async () => {
    answer({ mode: 'all_students', groupIds: [], studentIds: [] });
    renderSettings();

    expect(await screen.findByRole('radio', { name: /All students/ })).toBeChecked();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Chosen groups/ }));
    expect(screen.getByRole('checkbox', { name: /A2 evening/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Ola Nordmann/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Chosen students/ }));
    expect(screen.getByRole('checkbox', { name: /Ola Nordmann/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /A2 evening/ })).not.toBeInTheDocument();
  });

  it('saves both lists whatever the mode, so each is where the school left it', async () => {
    answer({ mode: 'selected_students', groupIds: [], studentIds: ['u-2'] });
    renderSettings();

    await userEvent.click(await screen.findByRole('radio', { name: /Chosen groups/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /B1 morning/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(sentBody()).toEqual({
        mode: 'selected_groups',
        groupIds: ['g-2'],
        studentIds: ['u-2'],
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('warns that a chosen mode with nobody in it pays for no one', async () => {
    answer({ mode: 'all_students', groupIds: [], studentIds: [] });
    renderSettings();

    await userEvent.click(await screen.findByRole('radio', { name: /Chosen students/ }));

    expect(screen.getByText(/Nobody is chosen yet/)).toBeInTheDocument();
  });

  it('says the plan refused, apart from anything else', async () => {
    answer(
      { mode: 'off', groupIds: [], studentIds: [] },
      { status: 403, body: { error: 'not_entitled' } },
    );
    renderSettings();

    await userEvent.click(await screen.findByRole('radio', { name: /All students/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/plan does not include/)),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reads both lists again when a chosen group or student is gone', async () => {
    answer(
      { mode: 'selected_groups', groupIds: [], studentIds: [] },
      { status: 422, body: { error: 'invalid_access' } },
    );
    renderSettings();

    await userEvent.click(await screen.findByRole('checkbox', { name: /A2 evening/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/no longer at the school/)),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a reader who may not change it what the school chose, greyed', async () => {
    answer({ mode: 'selected_groups', groupIds: ['g-1'], studentIds: [] });
    renderSettings({ canEdit: false });

    expect(await screen.findByRole('checkbox', { name: /A2 evening/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /A2 evening/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
