import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { WeakRules } from '../types';
import { WeakRulesPanel } from './weak-rules-panel';

const answer = (over: Partial<WeakRules> = {}): WeakRules => ({
  window: '30',
  since: '2026-10-03',
  courseId: null,
  rules: [
    {
      atomId: 'a1',
      title: 'V2 in main clauses',
      ruleId: 'r1',
      flags: 3,
      learners: 2,
      bySource: { aiPrecheck: 2, aiReview: 0, teacher: 1 },
      lastFlaggedAt: '2026-11-01T10:00:00.000Z',
    },
    {
      atomId: 'a2',
      title: null,
      ruleId: null,
      flags: 1,
      learners: 1,
      bySource: { aiPrecheck: 0, aiReview: 1, teacher: 0 },
      lastFlaggedAt: '2026-11-01T10:00:00.000Z',
    },
  ],
  ...over,
});

function mount(showLearners = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={client}>
        <WeakRulesPanel endpoint="/api/x/weak-rules" showLearners={showLearners} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('WeakRulesPanel', () => {
  it('lists rules, keeps an unnamed one, and asks the 30-day window first', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => answer() });
    vi.stubGlobal('fetch', fetchMock);
    mount();

    expect(await screen.findByText('V2 in main clauses')).toBeInTheDocument();
    expect(screen.getByText('A rule without a name')).toBeInTheDocument();
    expect(screen.getByText(/3 flags · 2 learners/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/x/weak-rules?window=30');
  });

  it('re-asks when the window changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => answer() });
    vi.stubGlobal('fetch', fetchMock);
    mount();
    await screen.findByText('V2 in main clauses');

    await userEvent.click(screen.getByRole('radio', { name: '7 days' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/x/weak-rules?window=7'));
  });

  it('says «no signal», not «no weak rules», when empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => answer({ rules: [] }) }),
    );
    mount();

    expect(await screen.findByText(/No rule was flagged in this period/)).toBeInTheDocument();
  });

  it('names a failure instead of drawing an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    mount();

    expect(await screen.findByText(/Could not load the weak rules/)).toBeInTheDocument();
  });
});
