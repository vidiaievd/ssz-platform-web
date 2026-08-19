import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewSubmission } from '@/features/review/types';

import { useReviewDraftsStore } from '../../stores/review-drafts';

const advance = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/en/school/oslo-skole/review/att-1',
}));

const { SubmissionPanel } = await import('./submission-panel');

const BASE: ReviewSubmission = {
  id: 'att-1',
  status: 'pending',
  student: { id: 's1', name: 'Anna Kowalska', groupName: 'A2 kveld' },
  exercise: {
    id: 'ex-1',
    title: 'Perfektum — uregelrette verb',
    type: 'writing_task',
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
  text: 'Jeg har bodd i Norge i tre år.',
  submittedAnswer: {},
  canDecide: true,
};

/** The submission read, the marker, and whatever the verdict is to answer with. */
function upstream(
  decision: { status: number; body: unknown } = { status: 200, body: { nextId: 'att-2' } },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/decision')) {
        return new Response(JSON.stringify(decision.body), { status: decision.status });
      }
      if (url.includes('/lock')) {
        return new Response(JSON.stringify({ lock: null, mine: init?.method === 'POST' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(BASE), { status: 200 });
    }),
  );
}

function renderPanel(props: { nextInQueue?: string | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SubmissionPanel
          school="oslo-skole"
          id="att-1"
          nextInQueue={props.nextInQueue ?? null}
          onAdvance={advance}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const decisionBody = () => {
  const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes('/decision'));
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useReviewDraftsStore.setState({ drafts: {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('the decision panel', () => {
  it('offers three verdicts and nowhere at all to type a mark (criterion 19)', async () => {
    upstream();
    renderPanel();

    expect(await screen.findByRole('button', { name: /^Pass$/ })).toBeEnabled();
    expect(screen.getByText(/no mark is entered by hand/)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('will not send work back until something has been said about it (criterion 18)', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    const back = await screen.findByRole('button', { name: /Send back for revision/ });
    expect(back).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'Se på ordstillingen.');
    expect(back).toBeEnabled();
  });

  it('carries the draft, and only the draft, to the verdict', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    await user.type(await screen.findByRole('textbox'), 'Bra jobbet.');
    await user.click(screen.getByRole('button', { name: /Pass with a comment/ }));

    await waitFor(() => expect(decisionBody()).toMatchObject({ verdict: 'approved_comment' }));
    expect(decisionBody().comment).toBe('Bra jobbet.');
    expect(JSON.stringify(decisionBody())).not.toContain('score');
  });

  it('moves on to the submission the server names, without going back to the list', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /^Pass$/ }));

    expect(await screen.findByText('Passed')).toBeInTheDocument();
    await waitFor(() => expect(advance).toHaveBeenCalledWith('att-2'));
  });

  it('says everything is reviewed in place, when the verdict emptied the queue', async () => {
    const user = userEvent.setup();
    upstream({ status: 200, body: { nextId: null } });
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /^Pass$/ }));

    expect(await screen.findByText('All reviewed')).toBeInTheDocument();
    expect(advance).not.toHaveBeenCalled();
  });

  it('clears the draft on the reviewer’s own verdict', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    await user.type(await screen.findByRole('textbox'), 'Bra jobbet.');
    await waitFor(() =>
      expect(useReviewDraftsStore.getState().drafts['att-1']?.comment).toBe('Bra jobbet.'),
    );

    await user.click(screen.getByRole('button', { name: /^Pass$/ }));
    await waitFor(() => expect(useReviewDraftsStore.getState().drafts['att-1']).toBeUndefined());
  });

  it('keeps the draft when a colleague got there first, and offers the next one (criteria 15, 24)', async () => {
    const user = userEvent.setup();
    upstream({
      status: 409,
      body: {
        code: 'ALREADY_REVIEWED',
        by: 't9',
        byName: 'Marius Berg',
        verdict: 'returned',
        at: new Date().toISOString(),
      },
    });
    renderPanel({ nextInQueue: 'att-7' });

    await user.type(await screen.findByRole('textbox'), 'Se på perfektum.');
    await user.click(screen.getByRole('button', { name: /Pass with a comment/ }));

    expect(await screen.findByText('Marius Berg has just reviewed this')).toBeInTheDocument();
    // The words survive the collision, and are still there to be copied out.
    expect(screen.getByRole('textbox')).toHaveValue('Se på perfektum.');
    expect(useReviewDraftsStore.getState().drafts['att-1']?.comment).toBe('Se på perfektum.');
    // The one thing left to do is the next piece of work.
    expect(screen.queryByRole('button', { name: /^Pass$/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next submission/ }));
    expect(advance).toHaveBeenCalledWith('att-7');
  });

  // The buttons already forbid the empty return, so this is the defence behind them:
  // the same refusal arriving from the server has to land on the field, not in a toast.
  it('puts a refused return beside the field, with the cursor in it (criterion 18)', async () => {
    const user = userEvent.setup();
    upstream({ status: 422, body: { code: 'RETURN_REQUIRES_COMMENT' } });
    renderPanel();

    await user.type(await screen.findByRole('textbox'), 'Se på ordstillingen.');
    await user.click(screen.getByRole('button', { name: /Send back for revision/ }));

    expect(await screen.findByText(/Say what should be changed/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('leaves no verdict to give when the assignment has run out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/lock')
          ? new Response(JSON.stringify({ lock: null, mine: false }), { status: 200 })
          : new Response(JSON.stringify({ ...BASE, canDecide: false }), { status: 200 }),
      ),
    );
    renderPanel();

    expect(await screen.findByText('You can no longer decide this one')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pass$/ })).not.toBeInTheDocument();
  });
});
