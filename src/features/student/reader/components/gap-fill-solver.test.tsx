import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

// Stub the learning barrel — its transitive imports pull in next/navigation,
// which isn't resolvable in the unit test environment.
vi.mock('@/features/learning', () => ({
  ErrorState: ({ onRetry }: { onRetry?: () => void }) => (
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  ),
  LearningSkeleton: () => <div>loading</div>,
}));

import { GapFillSolver } from './gap-fill-solver';

const PROJECTION = {
  sentences: [
    {
      id: 's1',
      tokens: [
        { kind: 'text', text: 'Jeg' },
        { kind: 'text', text: 'vil' },
        { kind: 'text', text: 'gjerne' },
        { kind: 'gap', gapKey: 's1#3', label: 'G1', before: '', after: '' },
        { kind: 'text', text: 'en' },
        { kind: 'text', text: 'kaffe.' },
      ],
    },
  ],
  bank: ['bestille', 'bestilt'],
  settings: { allowReuse: false, showBankCount: true, input: 'bank' },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'word_bank_gap_fill',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

const WRONG = {
  attemptId: 'att-1',
  correct: false,
  score: 0,
  requiresReview: false,
  feedback: { summary: 'Nesten!' },
  details: {
    totalGaps: 1,
    correctGaps: 0,
    gaps: [{ gapKey: 's1#3', correct: false, explanation: '«bestilt» needs «har».' }],
  },
};

const RIGHT = {
  ...WRONG,
  correct: true,
  score: 100,
  details: {
    totalGaps: 1,
    correctGaps: 1,
    gaps: [{ gapKey: 's1#3', correct: true, explanation: 'Infinitive after «vil gjerne».' }],
  },
};

const REVEALED = {
  attemptId: 'att-1',
  answers: [{ gapKey: 's1#3', label: 'G1', word: 'bestille', why: 'Infinitive.' }],
  attemptClosed: true,
};

/** Routes each POST by path, so a test only declares what it cares about. */
function mockApi(responses: { submit?: unknown; reveal?: unknown; startFails?: boolean }) {
  return vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(url);
    const body = path.endsWith('/reveal')
      ? responses.reveal
      : path.endsWith('/submit')
        ? responses.submit
        : STARTED;

    if (responses.startFails && !path.endsWith('/reveal') && !path.endsWith('/submit')) {
      return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function renderSolver(fetchMock: ReturnType<typeof mockApi>, onChecked?: (ok: boolean) => void) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <GapFillSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const gap = () => screen.getByRole('button', { name: /^G1:/ });

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('GapFillSolver', () => {
  it('starts an attempt and renders the masked projection', async () => {
    const fetchMock = mockApi({});
    renderSolver(fetchMock);

    await waitFor(() => expect(gap()).toBeInTheDocument());
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/exercises/ex-1/attempts');
    expect(screen.getByRole('button', { name: 'bestille' })).toBeInTheDocument();
  });

  it('will not let the learner check until every gap is filled', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({}));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Fill in every gap' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('sends the placements and shows the explanation that comes back', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ submit: WRONG });
    renderSolver(fetchMock);
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByText(/«bestilt» needs «har»/)).toBeInTheDocument());
    const submitCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
    expect(JSON.parse(String(submitCall?.[1]?.body))).toMatchObject({
      submittedAnswer: { placements: [{ gapKey: 's1#3', word: 'bestilt' }] },
    });
  });

  it('offers the answer only after a check, and never before', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ submit: WRONG }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /show/i })).toBeInTheDocument());
  });

  it('fetches the answers only when asked, and then shows them', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ submit: WRONG, reveal: REVEALED });
    renderSolver(fetchMock);
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => screen.getByRole('button', { name: /show/i }));

    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/reveal'))).toBe(false);

    await user.click(screen.getByRole('button', { name: /show/i }));
    await waitFor(() => expect(gap()).toHaveAccessibleName('G1: the answer is bestille'));
  });

  it('keeps attempts unlimited: a wrong check leaves the gap editable', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ submit: WRONG }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByText('Attempt 1')).toBeInTheDocument());

    expect(gap()).toBeEnabled();
  });

  it('stops asking once every gap is right', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ submit: RIGHT }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestille' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByText('Correct')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('reports the first check to progress, and only the first', async () => {
    const user = userEvent.setup();
    const onChecked = vi.fn();
    renderSolver(mockApi({ submit: WRONG }), onChecked);
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(false));

    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByText('Attempt 2')).toBeInTheDocument());
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('offers a retry rather than a blank page when the attempt cannot start', async () => {
    renderSolver(mockApi({ startFails: true }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument(),
    );
  });
});
