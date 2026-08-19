import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewSubmission } from '@/features/review/types';

// The panel's own fallback way onward, for the page that renders it without one.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/en/school/oslo-skole/review/att-1',
}));

const { SubmissionPanel } = await import('./submission-panel');

const IN_15_MIN = () => new Date(Date.now() + 15 * 60_000).toISOString();

const BASE: ReviewSubmission = {
  id: 'att-1',
  status: 'pending',
  student: { id: 's1', name: 'Anna Kowalska', groupName: 'A2 kveld' },
  exercise: {
    id: 'ex-1',
    title: 'Perfektum — uregelrette verb',
    type: 'short_answer',
    path: { course: 'Ny i Norge A2', lesson: 'Leksjon 7' },
    available: true,
    contentLang: 'nb',
  },
  submittedAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
  ageHours: 30,
  slaHours: 24,
  overdue: true,
  attemptNo: 1,
  previous: null,
  decision: null,
  lock: null,
  details: null,
  text: null,
  submittedAnswer: {},
  canDecide: true,
};

/**
 * Answers the submission read, and the lock call the way the BFF does: a claim never
 * displaces a colleague's live marker, so it answers with *their* lock and `mine: false`.
 */
function upstream(submission: Partial<ReviewSubmission> | 'error') {
  const held = submission !== 'error' ? (submission.lock ?? null) : null;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/lock')) {
        return new Response(
          JSON.stringify(
            held === null
              ? { lock: null, mine: init?.method === 'POST' }
              : { lock: held, mine: false },
          ),
          { status: 200 },
        );
      }
      return submission === 'error'
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify({ ...BASE, ...submission }), { status: 200 });
    }),
  );
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SubmissionPanel school="oslo-skole" id="att-1" position={{ index: 3, total: 27 }} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('SubmissionPanel', () => {
  it('orients the reviewer before anything else: path, learner, age, position', async () => {
    upstream({ details: { totalItems: 3, routedItems: 1, passedItems: 2, items: [] } });
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument();
    expect(screen.getByText('Ny i Norge A2 › Leksjon 7')).toBeInTheDocument();
    expect(screen.getByText('3 of 27')).toBeInTheDocument();
    expect(screen.getByText(/1 day/)).toBeInTheDocument();
  });

  it('opens a submission whose breakdown could not be built (criterion 20)', async () => {
    upstream({ details: null });
    renderPanel();

    expect(await screen.findByText('The breakdown could not be built')).toBeInTheDocument();
    // Still the work of a named learner, not an error page.
    expect(screen.getByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument();
  });

  it('opens a submission whose exercise has been deleted, under its saved path', async () => {
    upstream({ exercise: { ...BASE.exercise, available: false } });
    renderPanel();

    expect(await screen.findByText('The exercise is no longer there')).toBeInTheDocument();
    expect(screen.getByText('Ny i Norge A2 › Leksjon 7')).toBeInTheDocument();
  });

  it('names the colleague who got here first, and their outcome', async () => {
    upstream({
      decision: {
        attemptId: 'att-1',
        outcome: 'returned',
        at: new Date().toISOString(),
        reviewerId: 't9',
        reviewerName: 'Marius Berg',
        comment: null,
      },
    });
    renderPanel();

    expect(await screen.findByText('Marius Berg has just reviewed this')).toBeInTheDocument();
    expect(screen.getByText(/Returned for revision at/)).toBeInTheDocument();
  });

  it('says a colleague is in here without getting in the way', async () => {
    upstream({
      lock: { teacherId: 't9', teacherName: 'Marius Berg', expiresAt: IN_15_MIN() },
    });
    renderPanel();

    expect(await screen.findByText('Marius Berg is looking at this one')).toBeInTheDocument();
    expect(screen.getByText(/You are not blocked/)).toBeInTheDocument();
  });

  it('explains a lost verdict rather than letting the button fail later', async () => {
    upstream({ canDecide: false });
    renderPanel();

    expect(await screen.findByText('You can no longer decide this one')).toBeInTheDocument();
  });

  it('puts the previous verdict above the work that answers it', async () => {
    upstream({
      attemptNo: 2,
      previous: {
        attemptId: 'att-0',
        outcome: 'returned',
        at: new Date('2026-08-01T10:00:00Z').toISOString(),
        reviewerId: 't2',
        reviewerName: 'Ingrid Sæther',
        comment: 'Se på ordstillingen i setning 3.',
      },
    });
    renderPanel();

    expect(await screen.findByText('Se på ordstillingen i setning 3.')).toBeInTheDocument();
    expect(screen.getByText(/Ingrid Sæther/)).toBeInTheDocument();
  });

  it('claims the submission on open and lets go when the screen closes', async () => {
    upstream({});
    const { unmount } = renderPanel();
    await screen.findByRole('heading', { name: 'Anna Kowalska' });

    const calls = () =>
      vi.mocked(fetch).mock.calls.filter(([input]) => String(input).includes('/lock'));
    expect(calls().some(([, init]) => init?.method === 'POST')).toBe(true);

    unmount();
    expect(calls().some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });
});
