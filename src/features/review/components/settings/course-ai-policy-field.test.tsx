import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';
import { enMessages } from '@/lib/i18n/messages';

import { CourseAiPolicyField } from './course-ai-policy-field';

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

function renderField(keys: string[] = ['school.review_ai_policy']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EntitlementsProvider entitlements={entitlements(keys)}>
          <CourseAiPolicyField containerId="course-1" />
        </EntitlementsProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const POLICY = {
  autoAcceptAfterHours: 168,
  inheritedAutoAcceptAfterHours: 168,
  overridden: false,
  escalationFloorHours: 72,
  teacherReviewTemplates: [] as string[],
  schoolMode: 'ai_with_sampling',
  samplePercent: 15,
  ownerSchoolId: 'school-1',
};

function answer(policy: typeof POLICY) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === 'PUT'
      ? { ok: true, json: async () => ({ ...policy, ...JSON.parse(String(init.body)) }) }
      : { ok: true, json: async () => policy },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('CourseAiPolicyField', () => {
  it('draws nothing and asks nothing without the plan key', () => {
    answer(POLICY);
    const { container } = renderField([]);

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the school term greyed while the course inherits it', async () => {
    answer(POLICY);
    renderField();

    const field = await screen.findByLabelText('Auto-accept term in hours');
    expect(field).toHaveValue(168);
    expect(field).toBeDisabled();
    expect(screen.getByText("The school's term: 168 h.")).toBeInTheDocument();
  });

  it('says a term below the escalation will be raised to it, without refusing it', async () => {
    answer(POLICY);
    renderField();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Its own auto-accept/ }));
    const field = screen.getByLabelText('Auto-accept term in hours');
    await userEvent.clear(field);
    await userEvent.type(field, '24');

    expect(
      screen.getByText("Earlier than the school's escalation — it will count after 72 h."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('says it waits for the school while the school has teachers only', async () => {
    answer({ ...POLICY, schoolMode: 'teacher_only' });
    renderField();

    expect(
      await screen.findByText(/takes effect when the school turns a model on/),
    ).toBeInTheDocument();
  });

  it('saves the term as null and the chosen types whole', async () => {
    answer({ ...POLICY, teacherReviewTemplates: ['writing_task'] });
    renderField();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Error correction' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/content/containers/course-1/review-policy',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            autoAcceptAfterHours: null,
            teacherReviewTemplates: ['writing_task', 'error_correction'],
          }),
        }),
      );
    });
  });
});
