import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewQueueItem, ReviewQueueResponse } from '@/features/review/types';
import { useReviewViewStore } from '@/features/review/stores/review-view-store';

const replace = vi.fn();
let search = '';

const push = vi.fn();

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/en/school/oslo-skole/review',
  useSearchParams: () => new URLSearchParams(search),
}));

/** jsdom has no layout, so the panel's breakpoint has to be stated per test. */
function viewport(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

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

/** The panel opens beside the queue, so the stub has to answer for both endpoints. */
const SUBMISSION = {
  id: 'att-2',
  status: 'pending',
  student: { id: 's2', name: 'Peter Svensson', groupName: 'A2 kveld' },
  exercise: {
    id: 'ex-1',
    title: 'Perfektum',
    type: 'short_answer',
    path: { course: 'Ny i Norge A2', lesson: 'Leksjon 7' },
    available: true,
    contentLang: 'nb',
  },
  submittedAt: hoursAgo(30),
  ageHours: 30,
  slaHours: 24,
  overdue: true,
  attemptNo: 2,
  previous: null,
  decision: null,
  lock: null,
  details: null,
  text: null,
  submittedAnswer: {},
  canDecide: true,
};

function answer(
  body: ReviewQueueResponse | 'error',
  batch: { approved: number; skipped: { id: string; reason: string }[] } = {
    approved: 0,
    skipped: [],
  },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/batch-approve')) {
        return new Response(JSON.stringify(batch), { status: 200 });
      }
      if (url.includes('/submissions/')) {
        return new Response(JSON.stringify(SUBMISSION), { status: 200 });
      }
      return body === 'error'
        ? new Response('{}', { status: 502 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

/** The same queue, with both submissions closed outright by the machine. */
function cleanQueue(): ReviewQueueResponse {
  const group = QUEUE.groups[0]!;
  return {
    ...QUEUE,
    groups: [
      {
        ...group,
        autoCleanIds: ['att-1', 'att-2'],
        items: group.items.map((item) => ({ ...item, autoClean: true })),
      },
    ],
  };
}

/** What the batch call actually carried. */
function batchBody(): { attemptIds: string[] } {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([input]) => String(input).includes('/batch-approve'));
  return JSON.parse(String(call?.[1]?.body)) as { attemptIds: string[] };
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
  push.mockClear();
  viewport(true);
  // Folding is module-global client state; a group left shut by one test would make the
  // next one assert against an empty list for reasons nothing in it explains.
  useReviewViewStore.getState().expandAll();
  toastSuccess.mockClear();
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

const [FRESH, LATE] = QUEUE.groups[0]!.items as [ReviewQueueItem, ReviewQueueItem];

/** The same queue, with the two rows carrying whatever this test is about. */
function queueWith(
  items: ReviewQueueItem[],
  group: Partial<ReviewQueueResponse['groups'][0]> = {},
) {
  return {
    ...QUEUE,
    groups: [
      {
        ...QUEUE.groups[0]!,
        count: items.length,
        ages: items.map((item) => item.ageHours),
        items,
        ...group,
      },
    ],
  } satisfies ReviewQueueResponse;
}

describe('the queue list', () => {
  it('keeps an overdue submission in the same list as a fresh one', async () => {
    answer(QUEUE);
    renderInbox();

    // One list, one group heading, no second place for late work to be filed under.
    const rows = await screen.findAllByRole('button', { name: /waiting/ });
    expect(rows).toHaveLength(2);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('names the colleague holding a submission and still opens it', async () => {
    answer(
      queueWith([
        FRESH,
        {
          ...LATE,
          lock: {
            teacherId: 't9',
            teacherName: 'Marius Berg',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        },
      ]),
    );
    renderInbox();

    const row = await screen.findByRole('button', { name: /being reviewed by Marius Berg/ });
    expect(screen.getByText('Marius')).toBeInTheDocument();

    await userEvent.click(row);
    expect(replace).toHaveBeenCalledWith('?submission=att-2', { scroll: false });
  });

  it('offers the batch verdict only once two submissions are machine-clean', async () => {
    answer(queueWith([{ ...FRESH, autoClean: true }, LATE]));
    const { unmount } = renderInbox();
    await screen.findByText('Anna Kowalska');
    expect(screen.queryByRole('button', { name: /Pass/ })).not.toBeInTheDocument();
    unmount();

    answer(
      queueWith([
        { ...FRESH, autoClean: true },
        { ...LATE, autoClean: true },
      ]),
    );
    renderInbox();
    expect(await screen.findByRole('button', { name: 'Pass 2 clean' })).toBeInTheDocument();
  });

  it('leads a row with the exercise when the pass is through one learner', async () => {
    search = 'groupBy=student';
    answer(queueWith([FRESH, LATE], { kind: 'student', title: 'Anna Kowalska' }));
    renderInbox();

    // The learner is the heading; every row under it names the exercise instead.
    expect(await screen.findAllByText('Perfektum')).toHaveLength(2);
  });

  it('folds a group away without touching the address bar', async () => {
    answer(QUEUE);
    renderInbox();
    await screen.findByText('Anna Kowalska');

    await userEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('opens the submission beside the queue on a wide screen', async () => {
    search = 'submission=att-2';
    answer(QUEUE);
    renderInbox();

    // The panel's own heading is the learner, and the position is counted over the list
    // as it is filtered right now.
    expect(await screen.findByRole('heading', { name: 'Peter Svensson' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('sends a narrow screen to the submission page instead of a hidden column', async () => {
    viewport(false);
    answer(QUEUE);
    renderInbox();

    await userEvent.click(await screen.findByRole('button', { name: /Anna Kowalska/ }));
    expect(push).toHaveBeenCalledWith('/en/school/oslo-skole/review/att-1');
    expect(replace).not.toHaveBeenCalled();
  });

  it('names every learner before it offers the button that passes them (criterion 8)', async () => {
    const user = userEvent.setup();
    answer(cleanQueue());
    renderInbox();

    await user.click(await screen.findByRole('button', { name: 'Pass 2 clean' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Anna Kowalska')).toBeInTheDocument();
    expect(within(dialog).getByText('Peter Svensson')).toBeInTheDocument();
    expect(within(dialog).getByText(/no undo/i)).toBeInTheDocument();
    // Nothing has been sent by opening it.
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/batch-approve'))).toBe(
      false,
    );
  });

  it('carries out the list it showed, by id', async () => {
    const user = userEvent.setup();
    answer(cleanQueue(), { approved: 2, skipped: [] });
    renderInbox();

    await user.click(await screen.findByRole('button', { name: 'Pass 2 clean' }));
    await user.click(await screen.findByRole('button', { name: 'Pass 2' }));

    await waitFor(() => expect(batchBody().attemptIds).toEqual(['att-1', 'att-2']));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leaves out a submission a colleague already has open', async () => {
    const queue = cleanQueue();
    const group = queue.groups[0]!;
    group.items[1] = {
      ...group.items[1]!,
      lock: { teacherId: 't9', teacherName: 'Marius Berg', expiresAt: hoursAgo(-1) },
    };
    answer(queue);
    renderInbox();

    // One clean submission left, and the batch is offered from two upwards.
    expect(await screen.findByRole('button', { name: /Anna Kowalska/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pass \d+ clean/ })).not.toBeInTheDocument();
  });

  it('does not offer the batch when the pass is by learner', async () => {
    search = 'groupBy=student';
    answer(cleanQueue());
    renderInbox();

    expect(await screen.findByRole('button', { name: /Anna Kowalska/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clean/ })).not.toBeInTheDocument();
  });

  it('says what it could not do, beside what it did', async () => {
    const user = userEvent.setup();
    answer(cleanQueue(), { approved: 1, skipped: [{ id: 'att-2', reason: 'already_reviewed' }] });
    renderInbox();

    await user.click(await screen.findByRole('button', { name: 'Pass 2 clean' }));
    await user.click(await screen.findByRole('button', { name: 'Pass 2' }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0]?.[0]).toBe('1 submission passed');
    expect(toastSuccess.mock.calls[0]?.[1]).toMatchObject({
      description: '1 already answered by a colleague',
    });
  });
});
