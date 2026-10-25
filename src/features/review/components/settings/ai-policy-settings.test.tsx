import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';
import { enMessages } from '@/lib/i18n/messages';

import { AiPolicySettings } from './ai-policy-settings';

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

function renderSettings(keys: string[], canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EntitlementsProvider entitlements={entitlements(keys)}>
          <AiPolicySettings school="nordick" canEdit={canEdit} />
        </EntitlementsProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** The policy and the promise, each from its own route. */
function answer(policy: { mode: string; autoAcceptAfterHours: number; samplePercent: number }) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/review-settings')) {
      return {
        ok: true,
        json: async () => ({
          respondWithinHours: 48,
          escalateAfterHours: 72,
          escalateTo: 'school_admins',
        }),
      };
    }
    if (init?.method === 'PUT')
      return { ok: true, json: async () => JSON.parse(String(init.body)) };
    return { ok: true, json: async () => policy };
  });
}

const BOTH = ['school.review_ai_policy', 'ai.review_direct'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('AiPolicySettings', () => {
  it('draws nothing for a school whose plan has no model and none saved', async () => {
    answer({ mode: 'teacher_only', autoAcceptAfterHours: 168, samplePercent: 15 });
    const { container } = renderSettings([]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says a saved mode with a model no longer applies once the plan lost it', async () => {
    answer({ mode: 'ai_then_teacher', autoAcceptAfterHours: 168, samplePercent: 15 });
    renderSettings([]);

    expect(
      await screen.findByText(/does not include it now — teachers check all work/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows the term only for a mode with a model and the share only for sampling', async () => {
    answer({ mode: 'teacher_only', autoAcceptAfterHours: 168, samplePercent: 15 });
    renderSettings(BOTH);

    await screen.findByRole('radio', { name: /Teacher only/ });
    expect(screen.queryByText('Counts by itself after')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /teacher confirms/ }));
    expect(screen.getByText('Counts by itself after')).toBeInTheDocument();
    expect(screen.queryByText('Random share to the teacher')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /sees a sample/ }));
    expect(screen.getByText('Random share to the teacher')).toBeInTheDocument();
  });

  it('refuses a term earlier than the escalation before the round trip', async () => {
    answer({ mode: 'ai_then_teacher', autoAcceptAfterHours: 168, samplePercent: 15 });
    renderSettings(BOTH);

    const field = await screen.findByRole('spinbutton');
    await userEvent.clear(field);
    await userEvent.type(field, '48');

    expect(screen.getByText('Cannot come before the escalation (72 h).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the whole policy', async () => {
    answer({ mode: 'teacher_only', autoAcceptAfterHours: 168, samplePercent: 15 });
    renderSettings(BOTH);

    await userEvent.click(await screen.findByRole('radio', { name: /sees a sample/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/schools/nordick/review-policy',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            mode: 'ai_with_sampling',
            autoAcceptAfterHours: 168,
            samplePercent: 15,
          }),
        }),
      );
    });
  });

  it('warns that work goes to the teacher while the plan has no review credits', async () => {
    answer({ mode: 'ai_then_teacher', autoAcceptAfterHours: 168, samplePercent: 15 });
    renderSettings(['school.review_ai_policy']);

    expect(await screen.findByText(/no AI review credits/)).toBeInTheDocument();
  });
});
