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

function mockApi(responses: { submit?: unknown; startFails?: boolean; last?: unknown } = {}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);

    if (init?.method === undefined) {
      return new Response(JSON.stringify(responses.last ?? { attempt: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (responses.startFails && !path.endsWith('/submit')) {
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

  it('lets the learner start again when the author allows retries', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await correctIt();
    await userEvent.click(screen.getByRole('button', { name: 'Hand in' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Hand in' })).toBeInTheDocument();
    expect(await word('jeg')).toBeInTheDocument();
  });
});
