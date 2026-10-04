import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { tokenize } from '@/lib/shared-kernel/highlight-in-text';

// Stub the learning barrel — its transitive imports pull in next/navigation,
// which isn't resolvable in the unit test environment.
vi.mock('@/features/learning', () => ({
  ErrorState: ({ onRetry }: { onRetry?: () => void }) => (
    <button type="button" onClick={onRetry}>
      Reload
    </button>
  ),
  LearningSkeleton: () => <div>loading</div>,
}));

import { HighlightInTextSolver } from './highlight-in-text-solver';

const TEXT = 'I fjor sommer reiste vi til Bodø, og vi gikk på tur.\n\nDet var kaldt, men fint.';
const tokens = tokenize(TEXT);
const at = (w: string) => tokens.find((t) => t.w === w)!;
const range = (w: string) => ({ start: at(w).s, end: at(w).e });

/** The passage as the engine deals it: two questions and no trace of the key. */
const PROJECTION = {
  instruction: 'Les teksten.',
  text: TEXT,
  paragraphs: [
    [0, 52],
    [54, 78],
  ],
  questions: [
    { id: 'q1', prompt: 'Find the verbs in the past tense.', unit: 'word', count: null },
    { id: 'q2', prompt: 'Find the time expression.', unit: 'phrase', count: null },
  ],
  settings: { attempts: 2, hints: true, revealKey: true },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'highlight_in_text',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
  questionStates: [],
};

const state = (questionId: string, over: Record<string, unknown> = {}) => ({
  questionId,
  checks: 0,
  firstScore: null,
  firstPassed: null,
  passed: false,
  revealed: false,
  closed: false,
  ...over,
});

const scored = (details: Record<string, unknown>, correct = false) => ({
  attemptId: 'att-1',
  correct,
  score: 0,
  requiresReview: false,
  feedback: { summary: '' },
  details,
});

/** q1: «reiste» right, «til» extra, two missed. */
const FAILED = {
  questionId: 'q1',
  pct: 17,
  passed: false,
  exact: 1,
  near: 0,
  miss: 2,
  fp: 1,
  total: 3,
  cells: [
    { ...range('reiste'), state: 'exact' },
    { ...range('til'), state: 'fp' },
  ],
  attempt: 1,
  checksLeft: 1,
  closed: false,
  revealed: false,
  questions: [state('q1', { checks: 1, firstScore: 0.17, firstPassed: false }), state('q2')],
  complete: false,
  attemptPct: 8,
  attemptPassed: false,
};

const PASSED_Q1 = {
  ...FAILED,
  pct: 100,
  passed: true,
  exact: 3,
  miss: 0,
  fp: 0,
  cells: [],
  attempt: 2,
  checksLeft: 0,
  closed: true,
  questions: [
    state('q1', { checks: 2, firstScore: 0.17, firstPassed: false, passed: true, closed: true }),
    state('q2'),
  ],
};

const REVEALED_Q1 = {
  ...FAILED,
  passed: false,
  cells: [],
  closed: true,
  revealed: true,
  key: [
    { n: 1, ...range('reiste'), why: 'reise → reiste' },
    { n: 2, ...range('gikk'), why: 'gå → gikk' },
    { n: 3, ...range('var') },
  ],
  questions: [
    state('q1', { checks: 1, firstScore: 0.17, firstPassed: false, revealed: true, closed: true }),
    state('q2'),
  ],
};

const PASSED_Q2_COMPLETE = {
  ...PASSED_Q1,
  questionId: 'q2',
  total: 1,
  exact: 1,
  attempt: 1,
  questions: [
    state('q1', { checks: 2, passed: true, closed: true, firstPassed: false }),
    state('q2', { checks: 1, firstScore: 1, firstPassed: true, passed: true, closed: true }),
  ],
  complete: true,
  attemptPct: 59,
  attemptPassed: false,
};

interface ApiOptions {
  started?: Record<string, unknown>;
  /** Each submit in order; the last one repeats. */
  submits?: unknown[];
  submitStatus?: number;
}

function mockApi(options: ApiOptions = {}) {
  const submits = options.submits ?? [scored(FAILED)];
  const bodies: Array<{ submittedAnswer: unknown }> = [];
  let handed = 0;

  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/submit')) {
      if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body));
      const status = options.submitStatus ?? 200;
      if (status !== 200) return json({ error: 'nope' }, status);
      const body = submits[Math.min(handed, submits.length - 1)];
      handed += 1;
      return json(body);
    }

    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) return json({ status: 'IN_PROGRESS' });
      return json({ attempt: null });
    }

    return json({ ...STARTED, ...options.started });
  });

  return Object.assign(fetchMock, { bodies });
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
        <HighlightInTextSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const word = (name: string) => screen.getByRole('button', { name });

/** Mark «reiste» and «til» and hand them in. */
async function markAndCheck() {
  await userEvent.click(await screen.findByRole('button', { name: 'reiste' }));
  await userEvent.click(word('til'));
  await userEvent.click(screen.getByRole('button', { name: 'Check (2)' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HighlightInTextSolver', () => {
  it('sends the question id and the marks as character offsets, and draws the verdict', async () => {
    const api = mockApi();
    renderSolver(api);
    await markAndCheck();

    expect(await screen.findByText('1 of 3 right · 1 too many')).toBeInTheDocument();
    expect(api.bodies[0]?.submittedAnswer).toEqual({
      questionId: 'q1',
      marks: [range('reiste'), range('til')],
    });
  });

  it('a retry keeps exactly the right marks and moves the attempt on (AC-S6)', async () => {
    renderSolver(mockApi());
    await markAndCheck();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(word('reiste')).toHaveAttribute('aria-pressed', 'true');
    expect(word('til')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Check (1)' })).toBeEnabled();
    expect(screen.getByText('Attempt 2 of 2')).toBeInTheDocument();
  });

  it('a reveal asks for the key with no marks and draws it (AC-S9)', async () => {
    const api = mockApi({ submits: [scored(FAILED), scored(REVEALED_Q1)] });
    renderSolver(api);
    await markAndCheck();
    await userEvent.click(await screen.findByRole('button', { name: 'Show the answer' }));

    expect(await screen.findByText('2. gikk')).toBeInTheDocument();
    expect(api.bodies[1]?.submittedAnswer).toEqual({ questionId: 'q1', marks: [], reveal: true });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('goes on to the next question with nothing marked, and marks the rail (AC-S12)', async () => {
    renderSolver(mockApi({ submits: [scored(PASSED_Q1, true)] }));
    await markAndCheck();
    await userEvent.click(await screen.findByRole('button', { name: 'Next question' }));

    expect(screen.getByRole('group', { name: 'Find the time expression.' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(screen.getByText('Question 2 of 2, 1 done')).toBeInTheDocument();
    expect(screen.queryByText(/^Attempt/)).toBeNull();
  });

  it('reports progress once, on the submit that closes the attempt', async () => {
    const onChecked = vi.fn();
    const api = mockApi({ submits: [scored(PASSED_Q1, true), scored(PASSED_Q2_COMPLETE, true)] });
    renderSolver(api, onChecked);

    await markAndCheck();
    await screen.findByRole('button', { name: 'Next question' });
    expect(onChecked).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));
    await userEvent.click(word('sommer'));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1)' }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));
    // The attempt's verdict, not the last question's.
    expect(onChecked).toHaveBeenCalledWith(false);
    expect(api.bodies[1]?.submittedAnswer).toEqual({ questionId: 'q2', marks: [range('sommer')] });
  });

  it('resumes an open attempt on the first question still open, at the next check', async () => {
    renderSolver(
      mockApi({
        started: {
          questionStates: [
            state('q1', { checks: 1, passed: true, closed: true, firstPassed: true }),
            state('q2', { checks: 1, firstScore: 0, firstPassed: false }),
          ],
        },
      }),
    );

    expect(
      await screen.findByRole('group', { name: 'Find the time expression.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 2, 1 done')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2 of 2')).toBeInTheDocument();
  });

  it('refuses a passage that arrived with its key on it', async () => {
    renderSolver(
      mockApi({
        started: {
          exerciseContent: {
            ...PROJECTION,
            questions: [{ ...PROJECTION.questions[0], spans: [{ id: 's', start: 14, end: 20 }] }],
          },
        },
      }),
    );
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'reiste' })).toBeNull();
  });

  it('says the question is closed when the engine refuses the submit', async () => {
    renderSolver(mockApi({ submitStatus: 422 }));
    await markAndCheck();
    expect(await screen.findByText('This question is already finished.')).toBeInTheDocument();
  });
});
