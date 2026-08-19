import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/en/student/submissions',
  useSearchParams: () => search,
}));

import { MySubmissionsPage } from './my-submissions-page';
import type { MySubmission } from '../types';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

function submission(overrides: Partial<MySubmission> = {}): MySubmission {
  return {
    id: 'att-1',
    exerciseId: 'ex-1',
    exerciseTitle: 'Familien',
    course: 'Ny i Norge — A2',
    lesson: 'Leksjon 19',
    containerId: 'course-1',
    submittedAt: hoursAgo(5),
    status: 'pending',
    attemptNo: 1,
    expectedResponseBy: inHours(40),
    decision: null,
    canResubmit: false,
    ...overrides,
  };
}

const RETURNED = submission({
  id: 'att-2',
  status: 'returned',
  attemptNo: 2,
  expectedResponseBy: null,
  canResubmit: true,
  decision: {
    verdict: 'returned',
    teacherId: 'teacher-1',
    teacherName: 'Kari Nordmann',
    at: hoursAgo(2),
    comment: 'Se på perfektum.',
  },
});

const APPROVED_SILENTLY = submission({
  id: 'att-3',
  status: 'approved',
  expectedResponseBy: null,
  decision: {
    verdict: 'approved',
    teacherId: 'teacher-1',
    teacherName: 'Kari Nordmann',
    at: hoursAgo(1),
    comment: null,
  },
});

function mockApi(
  body: {
    items?: MySubmission[];
    summary?: { pending: number; returned: number; partial: boolean } | null;
    fails?: boolean;
  } = {},
) {
  return vi.fn(async (_url: RequestInfo | URL) => {
    if (body.fails) return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
    return new Response(
      JSON.stringify({
        summary: body.summary ?? { pending: 1, returned: 0, partial: false },
        items: body.items ?? [submission()],
        nextCursor: null,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
}

function renderPage(fetchMock: ReturnType<typeof mockApi>) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MySubmissionsPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  search = new URLSearchParams();
  replace.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MySubmissionsPage', () => {
  it('says how much is waiting and how much came back', async () => {
    renderPage(mockApi({ summary: { pending: 3, returned: 2, partial: false } }));

    expect(
      await screen.findByText(
        '3 pieces of work are waiting on a teacher, 2 came back for another go.',
      ),
    ).toBeInTheDocument();
  });

  it('says when those counts are only what is loaded so far', async () => {
    renderPage(mockApi({ summary: { pending: 3, returned: 2, partial: true } }));

    expect(await screen.findByText(/loaded so far/i)).toBeInTheDocument();
  });

  /** Invariant 2: waiting without a date reads as lost. */
  it('dates the answer a waiting submission is owed', async () => {
    renderPage(mockApi());

    expect(await screen.findByText(/Answer expected/)).toBeInTheDocument();
  });

  it('says plainly when nobody set a response time, rather than inventing one', async () => {
    renderPage(mockApi({ items: [submission({ expectedResponseBy: null })] }));

    expect(await screen.findByText('No response time set for this course')).toBeInTheDocument();
  });

  /** Criterion 39: a comment that has to be found is a comment that goes unread. */
  it('opens a returned submission by itself, with the teacher’s words already showing', async () => {
    renderPage(mockApi({ items: [RETURNED] }));

    expect(await screen.findByText('Se på perfektum.')).toBeInTheDocument();
    expect(screen.getByText('Comment · Kari Nordmann')).toBeInTheDocument();
  });

  it('lets a learner close the returned card, and leaves it closed', async () => {
    renderPage(mockApi({ items: [RETURNED] }));

    await userEvent.click(await screen.findByRole('button', { expanded: true }));

    expect(screen.queryByText('Se på perfektum.')).not.toBeInTheDocument();
  });

  it('keeps a marked submission closed until it is asked for', async () => {
    renderPage(mockApi({ items: [APPROVED_SILENTLY] }));

    const row = await screen.findByRole('button', { expanded: false });
    expect(screen.queryByText('Marked as correct, with nothing to add.')).not.toBeInTheDocument();

    await userEvent.click(row);

    // Criterion 40: a pass with nothing written on it is still a person's decision, and
    // an empty card would read as "nobody got to it yet".
    expect(screen.getByText('Marked as correct, with nothing to add.')).toBeInTheDocument();
  });

  it('opens the submission a notification pointed at', async () => {
    search = new URLSearchParams('submission=att-3');
    renderPage(mockApi({ items: [APPROVED_SILENTLY] }));

    expect(await screen.findByText('Marked as correct, with nothing to add.')).toBeInTheDocument();
  });

  it('collects a lesson handed in at one sitting under one heading', async () => {
    renderPage(
      mockApi({
        items: [
          submission({ id: 'a', exerciseTitle: 'Familien', submittedAt: hoursAgo(5) }),
          submission({ id: 'b', exerciseTitle: 'Preposisjoner', submittedAt: hoursAgo(5.2) }),
        ],
      }),
    );

    const heading = await screen.findByRole('heading', { name: 'Ny i Norge — A2 · Leksjon 19' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('2 exercises handed in')).toBeInTheDocument();
    // The course and lesson are on the heading once, not on both rows again.
    expect(screen.queryAllByText('Ny i Norge — A2 · Leksjon 19')).toHaveLength(1);
  });

  it('asks the server for the tab in the address bar', async () => {
    search = new URLSearchParams('status=returned');
    const fetchMock = mockApi({ items: [RETURNED], summary: null });
    renderPage(fetchMock);

    await screen.findByText('Se på perfektum.');
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/student/submissions?status=returned');
  });

  it('puts a chosen tab in the address bar, so the list can be returned to', async () => {
    renderPage(mockApi());

    await userEvent.click(await screen.findByRole('button', { name: /Another go/ }));

    expect(replace).toHaveBeenCalledWith('/en/student/submissions?status=returned', {
      scroll: false,
    });
  });

  it('offers a way back when the list cannot be loaded', async () => {
    renderPage(mockApi({ fails: true }));

    expect(await screen.findByText('Could not load your work')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says nothing has been handed in, rather than showing an empty page', async () => {
    renderPage(mockApi({ items: [] }));

    expect(await screen.findByText('Nothing handed in yet')).toBeInTheDocument();
  });

  it('distinguishes an empty tab from an empty history', async () => {
    search = new URLSearchParams('status=approved');
    renderPage(mockApi({ items: [], summary: null }));

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
  });
});
