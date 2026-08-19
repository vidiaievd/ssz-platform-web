import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { ErrorCorrectionSolver } from './error-correction-solver';

/** The masked exercise, as the server sends it: no corrected text anywhere in it. */
const PROJECTION = {
  mode: 'sentences',
  note: '',
  items: [
    {
      id: 'i1',
      wrong: 'I går jeg gikk på kino.',
      words: ['I', 'går', 'jeg', 'gikk', 'på', 'kino.'],
      errorCount: 1,
    },
  ],
  hints: { count: true, mark: false, hintText: true, showType: false },
  flow: {
    selfCheck: 2,
    attempts: 'free',
    showRefs: 'afterGraded',
    keyboard: true,
    showSpanCount: true,
  },
  totalErrors: 1,
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'error_correction',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

/** Anything short of an exact answer: routed, never marked wrong. */
const ROUTED = {
  attemptId: 'att-1',
  correct: false,
  score: null,
  requiresReview: true,
  feedback: { summary: 'Your answer has been submitted for review.' },
};

const PASSED = {
  attemptId: 'att-1',
  correct: true,
  score: 100,
  requiresReview: false,
  feedback: { summary: 'Correct!' },
};

/** A submitted attempt as the history endpoint reports it. */
const LAST_ATTEMPT = {
  attempt: {
    id: 'att-0',
    exerciseId: 'ex-1',
    templateCode: 'error_correction',
    status: 'ROUTED_FOR_REVIEW',
    checkMode: 'PRACTICE',
    score: null,
    passed: null,
    answersRevealed: false,
    submittedAnswer: { items: { i1: { marked: { 2: true }, fix: { 2: 'gikk' }, ins: {} } } },
    validationDetails: null,
    submittedAt: '2026-08-12T10:00:00.000Z',
    scoredAt: null,
  },
};

/** Counts and nothing else — the only thing a self-check is allowed to answer. */
const SELF_CHECK = {
  attemptId: 'att-1',
  templateCode: 'error_correction',
  checksUsed: 1,
  checksLeft: 1,
  fixedCount: 0,
  spanCount: 1,
  items: [{ itemId: 'i1', fixedCount: 0, spanCount: 1, fixedSpans: [false], strayEdits: 1 }],
};

function mockApi(
  responses: {
    submit?: unknown;
    submitFails?: boolean;
    startFails?: boolean;
    last?: unknown;
    selfCheck?: unknown;
    selfCheckStatus?: number;
    /** What `GET .../attempts/:attemptId` answers when a failed `submit` checks in (47.0.B). */
    attemptStatus?: unknown;
    attemptStatusFails?: boolean;
  } = {},
) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);

    if (path.endsWith('/self-check')) {
      const status = responses.selfCheckStatus ?? 200;
      return new Response(
        JSON.stringify(status === 200 ? (responses.selfCheck ?? SELF_CHECK) : { error: 'spent' }),
        { status, headers: { 'content-type': 'application/json' } },
      );
    }

    if (init?.method === undefined) {
      // `GET .../attempts/<attemptId>` (47.0.B's status check) vs.
      // `GET .../attempts` (the last-finished-attempt lookup) — same verb, different path.
      if (/\/attempts\/[^/]+$/.test(path)) {
        if (responses.attemptStatusFails) {
          return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
        }
        return new Response(
          JSON.stringify(responses.attemptStatus ?? { status: 'IN_PROGRESS' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(responses.last ?? { attempt: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (responses.startFails && !path.endsWith('/submit')) {
      return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
    }
    if (path.endsWith('/submit') && responses.submitFails) {
      return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
    }
    return new Response(JSON.stringify(path.endsWith('/submit') ? responses.submit : STARTED), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function renderSolver(
  fetchMock: ReturnType<typeof mockApi>,
  onChecked?: (ok: boolean | null) => void,
) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ErrorCorrectionSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const word = async (text: string) => screen.findByRole('button', { name: `Word: ${text}` });

/** Correct the inversion the way the answer key has it. */
async function correctIt() {
  fireEvent.click(await word('jeg'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gikk' } });
  fireEvent.blur(screen.getByRole('textbox'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('ErrorCorrectionSolver', () => {
  it('opens an attempt and shows the sentence, not the answer', async () => {
    renderSolver(mockApi());

    expect(await word('gikk')).toBeInTheDocument();
    expect(screen.getByText('1 mistake to find')).toBeInTheDocument();
  });

  it('offers a retry when the attempt cannot be opened', async () => {
    renderSolver(mockApi({ startFails: true }));

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('will not hand in an exercise with a sentence still untouched', async () => {
    renderSolver(mockApi({ submit: PASSED }));

    await userEvent.click(await screen.findByRole('button', { name: 'Hand in' }));

    expect(screen.getByText('1 sentence is still untouched')).toBeInTheDocument();
  });

  it('sends the edits, not the sentence they produce', async () => {
    const fetchMock = mockApi({ submit: PASSED });
    renderSolver(fetchMock);

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

    await waitFor(() => {
      const submitCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
      expect(submitCall).toBeDefined();
      const body = JSON.parse(String((submitCall![1] as RequestInit).body));
      expect(body.submittedAnswer).toEqual({
        items: { i1: { marked: { 2: true }, fix: { 2: 'gikk' }, ins: {} } },
      });
    });
  });

  it('says so when the answer was approved without a teacher', async () => {
    renderSolver(mockApi({ submit: PASSED }));

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

    expect(
      await screen.findByText('Everything correct — approved automatically'),
    ).toBeInTheDocument();
  });

  // The rule the template rests on: the machine may approve, and otherwise says
  // nothing about whether the answer was right.
  it('says the teacher has it, and never that the answer was wrong', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

    expect(await screen.findByText('Handed in. Your teacher will look at it.')).toBeInTheDocument();
    expect(screen.queryByText(/wrong|incorrect|Not quite/i)).not.toBeInTheDocument();
  });

  it('reports a routed answer as judged by nobody yet', async () => {
    const onChecked = vi.fn();
    renderSolver(mockApi({ submit: ROUTED }), onChecked);

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(null));
  });

  it('stops accepting edits once the work is with the teacher', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

    await screen.findByText('Handed in. Your teacher will look at it.');
    // Two of them: the word the learner rewrote, and the one that was already there.
    for (const button of await screen.findAllByRole('button', { name: 'Word: gikk' })) {
      expect(button).toBeDisabled();
    }
  });

  it('puts a previous submission back, and says it was handed in', async () => {
    renderSolver(mockApi({ last: LAST_ATTEMPT }));

    expect(await screen.findByText('Handed in. Your teacher will look at it.')).toBeInTheDocument();
    // The learner's own correction is back on screen, alongside the word it replaced.
    expect(await screen.findAllByRole('button', { name: 'Word: gikk' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Word: jeg' })).not.toBeInTheDocument();
  });

  // An exercise-engine older than the masking ships the stored document instead of the
  // projection — and with it the answer key. The runner refuses rather than plays it.
  it('will not play an exercise the server never masked', async () => {
    const unmasked = {
      ...STARTED,
      exerciseContent: {
        mode: 'sentences',
        note: '',
        items: [{ id: 'i1', wrong: 'I går jeg gikk på kino.' }],
        hints: PROJECTION.hints,
        flow: PROJECTION.flow,
      },
      expectedAnswers: { items: { i1: { ref: 'I går gikk jeg på kino.' } } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === undefined
          ? new Response(JSON.stringify({ attempt: null }), { status: 200 })
          : new Response(JSON.stringify(unmasked), { status: 200 }),
      ),
    );
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ErrorCorrectionSolver exerciseId="ex-1" language="no" />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hand in' })).not.toBeInTheDocument();
    expect(screen.queryByText('I går jeg gikk på kino.')).not.toBeInTheDocument();
  });

  it('asks the server how the work is going, and sends the draft to ask', async () => {
    const fetchMock = mockApi();
    renderSolver(fetchMock);

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Check my corrections (2 left)' }));

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/self-check'));
    expect(call).toBeDefined();
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
      draftAnswer: { items: { i1: { marked: { 2: true }, fix: { 2: 'gikk' }, ins: {} } } },
    });
    // Counts and the note about editing where there was no mistake — never a word.
    expect(await screen.findByText('0 of 1 mistakes corrected')).toBeInTheDocument();
    expect(
      screen.getByText('You also changed 1 word where there was no mistake'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my corrections (1 left)' })).toBeEnabled();
  });

  it('drops the self-check the moment the work changes under it', async () => {
    renderSolver(mockApi());

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Check my corrections (2 left)' }));
    expect(await screen.findByText('0 of 1 mistakes corrected')).toBeInTheDocument();

    fireEvent.click(await word('kino.'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'teater.' } });
    fireEvent.blur(screen.getByRole('textbox'));

    expect(screen.queryByText('0 of 1 mistakes corrected')).not.toBeInTheDocument();
  });

  it('puts the button away when the engine says the budget is spent', async () => {
    renderSolver(mockApi({ selfCheckStatus: 422 }));

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Check my corrections (2 left)' }));

    expect(await screen.findByRole('button', { name: 'No checks left' })).toBeDisabled();
    expect(screen.queryByText('Could not check that — try again')).not.toBeInTheDocument();
  });

  it('offers nothing to check before a single word has been touched', async () => {
    renderSolver(mockApi());

    expect(
      await screen.findByRole('button', { name: 'Check my corrections (2 left)' }),
    ).toBeDisabled();
  });

  it('lets the learner start again when the author allows retries', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Hand in' })).toBeInTheDocument();
    expect(await word('jeg')).toBeInTheDocument();
  });

  /**
   * 47.0.B: a failed `submit` is not a verdict on its own — the work may already have
   * reached the teacher, only the response got lost on the way back.
   */
  describe('when submit fails', () => {
    it('shows "handed in" — not an error — when the attempt already reached the teacher', async () => {
      renderSolver(mockApi({ submitFails: true, attemptStatus: { status: 'ROUTED_FOR_REVIEW' } }));

      await correctIt();
      await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

      expect(
        await screen.findByText('Handed in. Your teacher will look at it.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/did not go through|couldn't confirm/i)).not.toBeInTheDocument();
    });

    it('offers a resend, and says the last attempt did not go through, when nothing arrived', async () => {
      renderSolver(mockApi({ submitFails: true, attemptStatus: { status: 'IN_PROGRESS' } }));

      await correctIt();
      await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

      expect(
        await screen.findByText("That attempt didn't go through — your work is still here, try again."),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hand in' })).toBeEnabled();
    });

    it('says it could not confirm delivery, not that the work was lost, when the check itself fails', async () => {
      renderSolver(mockApi({ submitFails: true, attemptStatusFails: true }));

      await correctIt();
      await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));

      expect(
        await screen.findByText("Couldn't confirm that reached your teacher — try again."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/didn't go through/i)).not.toBeInTheDocument();
    });
  });

  describe('the unsent draft (47.0.C)', () => {
    /**
     * Reopening the exercise abandons the attempt the edits lived in, so without a draft
     * in the browser a reload is where the correction actually disappears — including the
     * reload that follows a failed hand-in.
     */
    it('keeps the correction across a reload, before anything is handed in', async () => {
      const { unmount } = renderSolver(mockApi());
      await correctIt();
      unmount();

      renderSolver(mockApi({ submit: ROUTED }));

      // Proof that the edits came back, not merely that the screen looks calm: an
      // untouched sentence refuses to be handed in at all.
      await userEvent.click(await screen.findByRole('button', { name: 'Hand in' }));
      expect(
        await screen.findByText('Handed in. Your teacher will look at it.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('1 sentence is still untouched')).not.toBeInTheDocument();
    });

    it('forgets the draft once the work has reached the engine', async () => {
      const { unmount } = renderSolver(mockApi({ submit: ROUTED }));
      await correctIt();
      await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));
      await screen.findByText('Handed in. Your teacher will look at it.');
      unmount();

      // A fresh visit with nothing on record: the sentence is untouched again, because
      // nothing should have come back out of storage.
      renderSolver(mockApi());

      await userEvent.click(await screen.findByRole('button', { name: 'Hand in' }));
      expect(screen.getByText('1 sentence is still untouched')).toBeInTheDocument();
    });
  });
});