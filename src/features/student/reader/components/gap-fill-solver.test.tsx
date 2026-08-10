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

/** A finished attempt as the history endpoint reports it. */
const LAST_ATTEMPT = {
  attempt: {
    id: 'att-0',
    exerciseId: 'ex-1',
    templateCode: 'word_bank_gap_fill',
    status: 'SCORED',
    checkMode: 'PRACTICE',
    score: 100,
    passed: true,
    answersRevealed: false,
    submittedAnswer: { placements: [{ gapKey: 's1#3', word: 'bestille' }] },
    validationDetails: {
      totalGaps: 1,
      correctGaps: 1,
      gaps: [{ gapKey: 's1#3', correct: true, explanation: null }],
    },
    submittedAt: '2026-08-08T10:00:00.000Z',
    scoredAt: '2026-08-08T10:00:01.000Z',
  },
};

/** Routes each POST by path, so a test only declares what it cares about. */
function mockApi(responses: {
  submit?: unknown;
  reveal?: unknown;
  startFails?: boolean;
  started?: unknown;
  /** The history lookup, which is the only GET the solver makes. */
  last?: unknown;
}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);

    if (init?.method === undefined) {
      return new Response(JSON.stringify(responses.last ?? { attempt: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = path.endsWith('/reveal')
      ? responses.reveal
      : path.endsWith('/submit')
        ? responses.submit
        : (responses.started ?? STARTED);

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
    const fetchMock = mockApi({});
    renderSolver(fetchMock);
    await waitFor(() => expect(gap()).toBeInTheDocument());

    const primary = screen.getByRole('button', { name: 'Fill in every gap' });
    expect(primary).toHaveAttribute('aria-disabled', 'true');

    // Pressing it points out what is missing instead of checking anything.
    await user.click(primary);
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/submit'))).toBe(false);
    expect(screen.getByText(/1 gaps are still empty/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    expect(screen.getByRole('button', { name: 'Check' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
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

  it('shows the answers in the sentences and nothing underneath them', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ submit: WRONG, reveal: REVEALED }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => screen.getByRole('button', { name: /show/i }));
    expect(screen.getByText(/«bestilt» needs «har»/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show/i }));

    await waitFor(() => expect(gap()).toHaveAccessibleName('G1: the answer is bestille'));
    // The answer is in the sentence; a block repeating it is a second reading of
    // what is already there. The check's note went with the check.
    expect(screen.queryByText(/G1 —/)).not.toBeInTheDocument();
    expect(screen.queryByText('Infinitive.')).not.toBeInTheDocument();
    expect(screen.queryByText(/«bestilt» needs «har»/)).not.toBeInTheDocument();
    expect(screen.getByText(/The answers are filled in above/)).toBeInTheDocument();
  });

  it('keeps the teacher’s note on the answer itself, a hover or a tap away', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ submit: WRONG, reveal: REVEALED }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => screen.getByRole('button', { name: /show/i }));
    await user.click(screen.getByRole('button', { name: /show/i }));

    await waitFor(() => expect(gap()).toHaveAccessibleName('G1: the answer is bestille'));
    expect(screen.queryByText('Infinitive.')).not.toBeInTheDocument();

    // The word carries it: no second control, and nothing on screen until asked.
    await user.click(gap());
    expect(await screen.findByText('Infinitive.')).toBeInTheDocument();
  });

  it('offers a full restart once the answers are out, and starts a new attempt', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ submit: WRONG, reveal: REVEALED });
    renderSolver(fetchMock);
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => screen.getByRole('button', { name: /show/i }));
    await user.click(screen.getByRole('button', { name: /show/i }));

    const again = await screen.findByRole('button', { name: 'Start over' });
    const startsBefore = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/attempts'),
    ).length;
    await user.click(again);

    // A clean run: a fresh attempt, an empty gap, and the bank back on screen.
    await waitFor(() => expect(gap()).toHaveAccessibleName('G1: empty gap'));
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/attempts')).length,
    ).toBeGreaterThan(startsBefore);
    expect(screen.getByRole('button', { name: 'bestilt' })).toBeInTheDocument();
  });

  it('keeps attempts unlimited: a wrong check leaves the gap editable', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ submit: WRONG }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Try again · attempt 2/ })).toBeInTheDocument(),
    );

    expect(gap()).toBeEnabled();
  });

  it('does not call a part-right check solved when the retry clears the wrong gaps', async () => {
    const user = userEvent.setup();
    // Two gaps: one right, one wrong. After the retry only the correct verdict is
    // left on screen, and reading "solved" off that would freeze the exercise.
    const twoGaps = {
      ...STARTED,
      exerciseContent: {
        ...PROJECTION,
        sentences: [
          {
            id: 's1',
            tokens: [
              { kind: 'gap', gapKey: 's1#0', label: 'G1', before: '', after: '' },
              { kind: 'text', text: 'og' },
              { kind: 'gap', gapKey: 's1#2', label: 'G2', before: '', after: '' },
            ],
          },
        ],
      },
    };
    const partly = {
      ...WRONG,
      details: {
        totalGaps: 2,
        correctGaps: 1,
        gaps: [
          { gapKey: 's1#0', correct: true, explanation: 'Riktig.' },
          { gapKey: 's1#2', correct: false, explanation: 'Not that one.' },
        ],
      },
    };
    renderSolver(mockApi({ started: twoGaps, submit: partly }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^G1:/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestille' }));
    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await user.click(await screen.findByRole('button', { name: /Try again · attempt 2/ }));

    expect(screen.queryByText('Correct', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^G2:/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Fill in every gap' })).toBeInTheDocument();
    // The gap that was right keeps its verdict, and with it its lock.
    expect(screen.getByRole('button', { name: 'G1: bestille, correct' })).toBeDisabled();
    // Its feedback block, though, belonged to the check that is now over.
    expect(screen.queryByText('Riktig.')).not.toBeInTheDocument();
    expect(screen.queryByText('Not that one.')).not.toBeInTheDocument();
  });

  it('empties the wrong gaps on the retry and keeps the right ones locked', async () => {
    const user = userEvent.setup();
    // Two gaps, one of each verdict, so the retry has something to keep.
    renderSolver(mockApi({ submit: WRONG }));
    await waitFor(() => expect(gap()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const retry = await screen.findByRole('button', { name: /Try again · attempt 2/ });
    expect(gap()).toHaveAccessibleName('G1: bestilt, wrong');

    await user.click(retry);

    // The wrong word is gone from the gap and back in the bank, and the exercise
    // is back to asking to be checked rather than to be corrected.
    expect(gap()).toHaveAccessibleName('G1: empty gap');
    expect(screen.getByRole('button', { name: 'Fill in every gap' })).toBeInTheDocument();
    expect(screen.queryByText(/«bestilt» needs «har»/)).not.toBeInTheDocument();
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

    await user.click(await screen.findByRole('button', { name: /Try again · attempt 2/ }));
    await user.click(screen.getByRole('button', { name: 'bestilt' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Try again · attempt 3/ })).toBeInTheDocument(),
    );
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('offers a retry rather than a blank page when the attempt cannot start', async () => {
    renderSolver(mockApi({ startFails: true }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument(),
    );
  });

  it('puts the last saved answer back in the gaps', async () => {
    renderSolver(mockApi({ last: LAST_ATTEMPT }));

    // The word the learner placed last time, marked with the verdict it earned —
    // not an empty exercise pretending the work was never done.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /G1: bestille, correct/ })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Your last answer, saved/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 gaps correct/)).toBeInTheDocument();
  });

  it('clears the restored answer when the learner wants to answer again', async () => {
    const user = userEvent.setup();
    renderSolver(mockApi({ last: LAST_ATTEMPT }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /G1: bestille, correct/ })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Answer again' }));

    expect(screen.getByRole('button', { name: /G1: empty gap/ })).toBeInTheDocument();
    expect(screen.queryByText(/Your last answer, saved/)).not.toBeInTheDocument();
  });

  it('shows an unanswered exercise when the history lookup fails', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === undefined) return new Response('nope', { status: 502 });
      return new Response(JSON.stringify(STARTED), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    renderSolver(fetchMock as unknown as ReturnType<typeof mockApi>);

    await waitFor(() => expect(gap()).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /G1: empty gap/ })).toBeInTheDocument();
    expect(screen.queryByText(/Your last answer, saved/)).not.toBeInTheDocument();
  });

  it('renders the exercise when the retry succeeds', async () => {
    const user = userEvent.setup();
    const responses = { startFails: true };
    renderSolver(mockApi(responses));
    const retry = await screen.findByRole('button', { name: /try again|retry/i });

    // The retry has to run the same start path as the mount, projection included:
    // a retry that only re-fired the request would sit on the skeleton for good.
    responses.startFails = false;
    await user.click(retry);

    await waitFor(() => expect(gap()).toBeInTheDocument());
  });
});
