import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

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

import { MultipleChoiceGroupSolver } from './multiple-choice-group-solver';

const R1 = 'Bartek er fornøyd med jobben sin.';
const R2 = 'Bartek har søkt på en ny stilling.';

/** The table as the server projects it: statements and columns, and no trace of the key. */
const PROJECTION = {
  instruction: 'Riktig eller galt?',
  source: { mode: 'inline', label: 'Tekst 1A', text: 'Bartek søker ny jobb.' },
  columns: [
    { id: 'c-r', label: 'Riktig' },
    { id: 'c-g', label: 'Galt' },
  ],
  rows: [
    { id: 'r1', text: R1 },
    { id: 'r2', text: R2 },
  ],
  settings: {
    numbering: true,
    layout: 'auto',
    retry: 'one',
    progress: true,
    showText: true,
    passThreshold: 70,
  },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'multiple_choice_group',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

/** One check, dosed the way the engine doses it. */
const scored = (details: Record<string, unknown>, correct = false) => ({
  attemptId: 'att-1',
  correct,
  score: 50,
  requiresReview: false,
  feedback: { summary: '' },
  details,
});

const OPEN = {
  totalItems: 2,
  passedItems: 1,
  attempt: 1,
  attemptsLeft: 1,
  closed: false,
  locked: ['r1'],
  items: [
    { itemId: 'r1', submitted: 'c-g', correct: true, firstAnswer: 'c-g' },
    { itemId: 'r2', submitted: 'c-g', correct: false, firstAnswer: 'c-g' },
  ],
};

const CLOSED = {
  ...OPEN,
  attempt: 2,
  attemptsLeft: 0,
  closed: true,
  items: [
    { itemId: 'r1', submitted: 'c-g', correct: true, firstAnswer: 'c-g' },
    {
      itemId: 'r2',
      submitted: 'c-g',
      correct: false,
      firstAnswer: 'c-g',
      keyColumnId: 'c-r',
      why: 'Han har søkt på en stilling.',
    },
  ],
};

interface ApiOptions {
  content?: unknown;
  /** Each check in order; the last one repeats. */
  checks?: unknown[];
  submitStatus?: number;
}

function mockApi(options: ApiOptions = {}) {
  const checks = options.checks ?? [scored(OPEN)];
  const bodies: unknown[] = [];
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
      const body = checks[Math.min(handed, checks.length - 1)];
      handed += 1;
      return json(body);
    }

    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) return json({ status: 'SCORED' });
      return json({ attempt: null });
    }

    return json({
      ...STARTED,
      ...(options.content === undefined ? {} : { exerciseContent: options.content }),
    });
  });

  return Object.assign(fetchMock, { bodies });
}

function renderSolver(
  fetchMock: ReturnType<typeof mockApi>,
  onChecked?: (ok: boolean | null) => void,
  sourceHref?: string,
) {
  vi.stubGlobal('fetch', fetchMock);
  // JSDOM measures every element at 0, which is the cards branch. The table is the
  // layout with a named cell per statement and column, so the tests are written against
  // it — told apart the way the body tells them apart, by how much room it is given.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 960,
    height: 600,
    top: 0,
    left: 0,
    right: 960,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MultipleChoiceGroupSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
          {...(sourceHref === undefined ? {} : { sourceHref })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const cell = (statement: string, column: string) =>
  screen.getByRole('radio', { name: `${statement} — ${column}` });

/** Answer both statements and hand the table in. */
async function answerAndCheck() {
  await userEvent.click(cell(R1, 'Galt'));
  await userEvent.click(cell(R2, 'Galt'));
  await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MultipleChoiceGroupSolver', () => {
  it('opens an attempt and draws the table the server projected', async () => {
    renderSolver(mockApi());

    expect(await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ })).toBeInTheDocument();
    expect(screen.getByText('Bartek søker ny jobb.')).toBeInTheDocument();
  });

  it('hands the way back to the lesson down to the table', async () => {
    // The document holds no lesson id — the builder never writes one (plan 54 Q5) — so
    // the link exists only because the page around the solver resolved it.
    renderSolver(
      mockApi({ content: { ...PROJECTION, source: { mode: 'link', label: 'Tekst 1A' } } }),
      undefined,
      '/en/student/courses/c1/u1/t1',
    );

    const link = await screen.findByRole('link', { name: 'Go to the text: Tekst 1A' });
    expect(link).toHaveAttribute('href', '/en/student/courses/c1/u1/t1');
  });

  it('refuses a table that arrived with its answer key on it', async () => {
    renderSolver(
      mockApi({
        content: { ...PROJECTION, rows: [{ id: 'r1', text: R1, answer: 'c-g' }] },
      }),
    );

    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('sends the whole table and nothing else, and draws the verdict that came back', async () => {
    const api = mockApi();
    renderSolver(api);
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });

    await answerAndCheck();

    await waitFor(() => expect(screen.getByText('1 statement is wrong')).toBeInTheDocument());

    const submitted = (api.bodies[0] as { submittedAnswer: Record<string, unknown> })
      .submittedAnswer;
    expect(submitted['answers']).toEqual({ r1: 'c-g', r2: 'c-g' });
    // Which check this is, which rows are frozen and what was picked the first time round
    // are the attempt's own facts; a client that stated them would be buying itself a go.
    expect(submitted).not.toHaveProperty('attempt');
    expect(submitted).not.toHaveProperty('locked');
    expect(submitted).not.toHaveProperty('firstAnswers');
  });

  it('reports progress once, on the first check', async () => {
    const onChecked = vi.fn();
    renderSolver(mockApi({ checks: [scored(OPEN), scored(CLOSED)] }), onChecked);
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });

    await answerAndCheck();
    await waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'Try the wrong ones again' }));
    await userEvent.click(cell(R2, 'Riktig'));
    await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));

    await waitFor(() => expect(screen.getByText('Attempt 2')).toBeInTheDocument());
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows the server froze and clears the rest on a retry', async () => {
    renderSolver(mockApi());
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });
    await answerAndCheck();
    await waitFor(() => expect(screen.getByText('1 statement is wrong')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Try the wrong ones again' }));

    // `r1` is in `locked`, so its answer survives and its cells stay shut; `r2` is blank
    // again and open, which is what the button offers to do.
    expect(cell(R1, 'Galt')).toHaveAttribute('aria-checked', 'true');
    expect(cell(R1, 'Galt')).toBeDisabled();
    expect(cell(R2, 'Galt')).toHaveAttribute('aria-checked', 'false');
    expect(cell(R2, 'Galt')).toBeEnabled();
    expect(screen.getByText('1 left')).toBeInTheDocument();
  });

  it('spends a check on «Show the answers» and closes the table with it', async () => {
    const api = mockApi({ checks: [scored(OPEN), scored(CLOSED)] });
    renderSolver(api);
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });
    await answerAndCheck();
    await waitFor(() => expect(screen.getByText('1 statement is wrong')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Show the answers' }));

    await waitFor(() => expect(screen.getByText('Not passed')).toBeInTheDocument());
    const revealed = (api.bodies[1] as { submittedAnswer: Record<string, unknown> })
      .submittedAnswer;
    expect(revealed['reveal']).toBe(true);
    // The key arrives with the closing check, and only then.
    expect(screen.getByText('Han har søkt på en stilling.')).toBeInTheDocument();
  });

  it('offers no further check once the server says the table is closed', async () => {
    renderSolver(mockApi({ checks: [scored(CLOSED)] }));
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });
    await answerAndCheck();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: 'Try the wrong ones again' }),
    ).not.toBeInTheDocument();
  });

  it('tells a refusal apart from a request that never landed', async () => {
    const { unmount } = renderSolver(mockApi({ submitStatus: 422 }));
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });
    await answerAndCheck();

    expect(await screen.findByText('This table is already finished.')).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    renderSolver(mockApi({ submitStatus: 502 }));
    await screen.findByRole('rowheader', { name: /Bartek er fornøyd/ });
    await answerAndCheck();

    // A 502 may still have landed — the engine takes a submission before it scores it —
    // so the attempt is asked about, and it says the check is in.
    expect(await screen.findByText('This table is already finished.')).toBeInTheDocument();
  });
});
