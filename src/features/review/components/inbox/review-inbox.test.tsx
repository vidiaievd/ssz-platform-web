import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewQueueResponse } from '@/features/review/types';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const { ReviewInbox } = await import('./review-inbox');

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const QUEUE: ReviewQueueResponse = {
  summary: { pending: 2, overdue: 1, overduePartial: false, oldestHours: 30 },
  facets: {
    groups: [{ id: 'g1', name: 'A2 kveld' }],
    courses: [{ id: 'c1', name: 'Ny i Norge A2' }],
  },
  groups: [
    {
      key: 'ex-1',
      kind: 'exercise',
      title: 'Perfektum',
      path: { course: 'Ny i Norge A2', lesson: 'Leksjon 7', type: 'short_answer' },
      slaHours: 24,
      count: 2,
      ages: [3, 30],
      overdue: 1,
      autoCleanIds: [],
      items: [
        {
          id: 'att-1',
          student: { id: 's1', name: 'Anna Kowalska', groupName: 'A2 kveld' },
          exerciseId: 'ex-1',
          exerciseTitle: 'Perfektum',
          submittedAt: hoursAgo(3),
          ageHours: 3,
          overdue: false,
          attemptNo: 1,
          autoClean: false,
          lock: null,
        },
        {
          id: 'att-2',
          student: { id: 's2', name: 'Peter Svensson', groupName: 'A2 kveld' },
          exerciseId: 'ex-1',
          exerciseTitle: 'Perfektum',
          submittedAt: hoursAgo(30),
          ageHours: 30,
          overdue: true,
          attemptNo: 2,
          autoClean: false,
          lock: null,
        },
      ],
    },
  ],
  nextCursor: null,
};

const EMPTY: ReviewQueueResponse = {
  summary: { pending: 0, overdue: 0, overduePartial: false, oldestHours: null },
  facets: QUEUE.facets,
  groups: [],
  nextCursor: null,
};

function answer(body: ReviewQueueResponse | 'error') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      body === 'error'
        ? new Response('{}', { status: 502 })
        : new Response(JSON.stringify(body), { status: 200 }),
    ),
  );
}

function renderInbox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReviewInbox school="oslo-skole" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  search = '';
  replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('ReviewInbox', () => {
  it('says how much is waiting, how much is late and how old the oldest is', async () => {
    answer(QUEUE);
    renderInbox();

    expect(
      await screen.findByText('2 submissions · 1 longer than promised · oldest 1 day'),
    ).toBeInTheDocument();
  });

  it('marks the overdue count as partial while a page is still unread', async () => {
    answer({ ...QUEUE, nextCursor: 'more', summary: { ...QUEUE.summary, overduePartial: true } });
    renderInbox();

    expect(await screen.findByText(/1\+ longer than promised/)).toBeInTheDocument();
  });

  it('carries the age in words on every row, never colour alone', async () => {
    answer(QUEUE);
    renderInbox();

    expect(await screen.findByText('Anna Kowalska')).toBeInTheDocument();
    expect(screen.getByText('3 hours')).toBeInTheDocument();
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('shows an emptied queue as an achievement, with nothing to undo', async () => {
    answer(EMPTY);
    renderInbox();

    expect(await screen.findByText('All reviewed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows an emptied filter as a dead end, with the way out beside it', async () => {
    search = 'overdue=true';
    answer(EMPTY);
    renderInbox();

    expect(await screen.findByText('Nothing under these filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(replace).toHaveBeenCalledWith('', { scroll: false });
  });

  it('writes a filter into the address bar rather than into its own state', async () => {
    answer(QUEUE);
    renderInbox();
    await screen.findByText('Anna Kowalska');

    await userEvent.click(screen.getByRole('button', { name: 'Longer than promised' }));
    expect(replace).toHaveBeenCalledWith('?overdue=true', { scroll: false });
  });

  it('keeps the open submission when a filter changes', async () => {
    search = 'submission=att-2';
    answer(QUEUE);
    renderInbox();
    await screen.findByText('Anna Kowalska');

    await userEvent.click(screen.getByRole('button', { name: 'Longer than promised' }));
    expect(replace).toHaveBeenCalledWith('?overdue=true&submission=att-2', { scroll: false });
  });

  it('offers a way back when the queue could not be loaded', async () => {
    answer('error');
    renderInbox();

    expect(await screen.findByText('The queue could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('restores the grouping the link carried', async () => {
    search = 'groupBy=student';
    answer(QUEUE);
    renderInbox();

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'By learner' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
  });
});
