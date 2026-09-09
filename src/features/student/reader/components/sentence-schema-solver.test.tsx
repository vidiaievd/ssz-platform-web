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
      Try again
    </button>
  ),
  LearningSkeleton: () => <div>loading</div>,
}));

import { SentenceSchemaSolver } from './sentence-schema-solver';

/** Two sentences as the server projects them: fields, a shuffled bank, no key. */
const PROJECTION = {
  title: 'Indirekte tale',
  instruction: 'Bygg om setningen og legg ordene i skjemaet.',
  rows: [
    {
      id: 'r1',
      clause: 'sub',
      fields: [
        { id: 'f-sub', short: 'sub', label: 'Subjunksjon', hint: '', optional: false },
        { id: 'f-v', short: 'v', label: 'Verbal', hint: '', optional: false },
      ],
      bank: [
        { id: 'c2', text: 'kommer' },
        { id: 'c1', text: 'at' },
      ],
      source: '«Jeg kommer», sa han.',
      counts: null,
      start: {},
    },
    {
      id: 'r2',
      clause: 'sub',
      fields: [
        { id: 'f-sub', short: 'sub', label: 'Subjunksjon', hint: '', optional: false },
        { id: 'f-v', short: 'v', label: 'Verbal', hint: '', optional: false },
      ],
      bank: [
        { id: 'd1', text: 'om' },
        { id: 'd2', text: 'leser' },
      ],
      source: '«Leser du?», spurte hun.',
      counts: null,
      start: {},
    },
  ],
  settings: {
    labels: true,
    hints: false,
    counts: false,
    prefill: 'none',
    markEmpty: false,
    perField: true,
    hintAfterMistake: true,
    shuffle: true,
    extras: true,
    order: 'strict',
  },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'sentence_schema',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

const wrong = {
  attemptId: 'att-1',
  closed: 0,
  total: 2,
  result: {
    rowId: 'r1',
    attempt: 1,
    byItem: { c2: 'field' },
    byField: { 'f-sub': 'bad', 'f-v': 'empty' },
    wrong: 1,
    solved: false,
    score: 0,
    why: null,
    text: null,
    solution: null,
    banner: { source: 'why', text: 'Subjunksjonen står først.', code: null, hint: '' },
  },
};

const solved = (rowId: string) => ({
  attemptId: 'att-1',
  closed: rowId === 'r1' ? 1 : 2,
  total: 2,
  result: {
    rowId,
    attempt: 2,
    byItem: rowId === 'r1' ? { c1: 'ok', c2: 'ok' } : { d1: 'ok', d2: 'ok' },
    byField: { 'f-sub': 'ok', 'f-v': 'ok' },
    wrong: 0,
    solved: true,
    score: 100,
    why: 'Verbet står etter subjektet.',
    text: rowId === 'r1' ? 'at kommer' : 'om leser',
    solution: null,
    banner: { source: 'why', text: 'Verbet står etter subjektet.', code: null, hint: '' },
  },
});

const revealed = {
  attemptId: 'att-1',
  closed: 1,
  total: 2,
  result: {
    rowId: 'r1',
    attempt: 1,
    byItem: { c1: 'ok', c2: 'ok' },
    byField: { 'f-sub': 'ok', 'f-v': 'ok' },
    wrong: 0,
    solved: false,
    score: 0,
    why: 'Verbet står etter subjektet.',
    text: 'at kommer',
    solution: { 'f-sub': ['c1'], 'f-v': ['c2'] },
    banner: { source: 'why', text: 'Verbet står etter subjektet.', code: null, hint: '' },
  },
};

const SCORED = {
  attemptId: 'att-1',
  correct: true,
  score: 100,
  requiresReview: false,
  feedback: { summary: 'Riktig!' },
};

interface ApiOptions {
  content?: unknown;
  startFails?: boolean;
  /** Each check in order; the last one repeats. */
  checks?: unknown[];
  checkStatus?: number;
  submitFails?: boolean;
  /** What the engine says has already been worked on in the attempt it hands back. */
  checkedRows?: unknown[];
}

function mockApi(options: ApiOptions = {}) {
  const checks = options.checks ?? [wrong, solved('r1'), solved('r2')];
  let checked = 0;

  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/rows')) {
      const status = options.checkStatus ?? 200;
      if (status !== 200) return json({ error: 'nope' }, status);
      const body = checks[Math.min(checked, checks.length - 1)];
      checked += 1;
      return json(body);
    }

    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) return json({ status: 'IN_PROGRESS' });
      return json({ attempt: null });
    }

    if (path.endsWith('/submit')) {
      if (options.submitFails) return json({ error: 'nope' }, 502);
      return json(SCORED);
    }

    if (options.startFails) return json({ error: 'nope' }, 502);
    return json({
      ...STARTED,
      ...(options.content === undefined ? {} : { exerciseContent: options.content }),
      ...(options.checkedRows === undefined ? {} : { checkedRows: options.checkedRows }),
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
        <SentenceSchemaSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const bodyOf = (call: [RequestInfo | URL, (RequestInit | undefined)?] | undefined) =>
  JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;

afterEach(() => vi.unstubAllGlobals());

describe('SentenceSchemaSolver', () => {
  it('opens an attempt and shows the first sentence with its pieces', async () => {
    renderSolver(mockApi());

    expect(await screen.findByText('«Jeg kommer», sa han.')).toBeInTheDocument();
    expect(screen.getByLabelText('Sentence 1 of 2')).toBeInTheDocument();
    // In the order the server shuffled them into — nothing here reorders the bank.
    expect(
      screen.getAllByRole('button', { name: /^(kommer|at)$/ }).map((b) => b.textContent),
    ).toEqual(['kommer', 'at']);
  });

  it('sends the board to be checked and shows the marks the server sent', async () => {
    const fetchMock = mockApi();
    renderSolver(fetchMock);
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'kommer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1/2)' }));

    expect(await screen.findByText('Subjunksjonen står først.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/rows'));
    expect(bodyOf(call)).toEqual({
      rowId: 'r1',
      placement: { 'f-sub': ['c2'] },
      reveal: false,
    });
  });

  it('keeps what was right when the learner fixes it, and counts the attempt up', async () => {
    // `Rett opp` is the whole design of this type: retyping work already judged correct
    // teaches nothing and reads as punishment.
    renderSolver(
      mockApi({
        checks: [{ ...wrong, result: { ...wrong.result, byItem: { c1: 'ok', c2: 'field' } } }],
      }),
    );
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'at' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'kommer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (2/2)' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Fix (1)' }));

    // The correct piece stayed on the board; the wrong one went back to the bank.
    expect(screen.getByRole('button', { name: 'Place in Subjunksjon' })).toHaveTextContent('at');
    expect(screen.getByRole('button', { name: 'Check (1/2)' })).toBeInTheDocument();
  });

  it('closes the sentence when it is solved and moves on', async () => {
    renderSolver(mockApi({ checks: [solved('r1')] }));
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'at' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1/2)' }));

    // The sentence arrives with the verdict, and only then.
    expect(await screen.findByText('at kommer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next sentence' }));
    expect(screen.getByText('«Leser du?», spurte hun.')).toBeInTheDocument();
  });

  it('puts a sentence aside without sending anything, and offers it again at the end', async () => {
    const fetchMock = mockApi({ checks: [solved('r2')] });
    renderSolver(fetchMock);
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    // Straight to the second sentence, and nothing was reported about the first: an
    // unanswered sentence is not a verdict the server has an opinion about.
    expect(screen.getByText('«Leser du?», spurte hun.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/rows'))).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'om' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1/2)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next sentence' }));

    // Back to the one that was put aside, and told why the set went backwards.
    expect(screen.getByText('«Jeg kommer», sa han.')).toBeInTheDocument();
    expect(screen.getByText('You put this one aside earlier')).toBeInTheDocument();
  });

  it('ends the set when a sentence is refused a second time, and counts it as skipped', async () => {
    renderSolver(mockApi({ checks: [solved('r2')] }));
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await userEvent.click(screen.getByRole('button', { name: 'om' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1/2)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next sentence' }));

    // Second refusal is final — the set ends rather than offering it a third time.
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByText('1 solved · 0 shown · 1 skipped')).toBeInTheDocument();
  });

  it('shows the schema on request, fills the board from the server and closes the sentence', async () => {
    const fetchMock = mockApi({ checks: [revealed] });
    renderSolver(fetchMock);
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'Show the correct schema' }));

    expect(await screen.findByText('at kommer')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/rows'));
    expect(bodyOf(call)['reveal']).toBe(true);
    // Locked: nothing is a drop target any more.
    expect(screen.queryByRole('button', { name: 'Place in Subjunksjon' })).not.toBeInTheDocument();
  });

  it('closes the set with every board at once, and tells the server what was shown', async () => {
    // The reveal travels, and the engine writes its own record over it — a client that
    // could leave the flag off would have found the cheapest route to a full score.
    const fetchMock = mockApi({ checks: [revealed, solved('r2')] });
    const onChecked = vi.fn();
    renderSolver(fetchMock, onChecked);
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'Show the correct schema' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next sentence' }));

    await userEvent.click(screen.getByRole('button', { name: 'om' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1/2)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(true));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
    const submitted = bodyOf(call)['submittedAnswer'] as { rows: Array<Record<string, unknown>> };
    expect(submitted.rows).toEqual([
      { rowId: 'r1', placement: { 'f-sub': ['c1'], 'f-v': ['c2'] }, revealed: true },
      { rowId: 'r2', placement: { 'f-sub': ['d1'] }, revealed: false },
    ]);
    expect(screen.getByText('All 2 sentences done')).toBeInTheDocument();
  });

  it('picks the set up where it was left, with the sentence that was shown still closed', async () => {
    // Plan 52 §3.3: reopening a revealed sentence on a reload would make a reload the
    // cheapest way to a full mark.
    renderSolver(
      mockApi({
        checkedRows: [
          {
            rowId: 'r1',
            attempts: 3,
            placement: { 'f-sub': ['c1'], 'f-v': ['c2'] },
            solved: false,
            revealed: true,
          },
        ],
      }),
    );

    // Straight to the second sentence: the first is closed.
    expect(await screen.findByText('«Leser du?», spurte hun.')).toBeInTheDocument();
    expect(screen.getByLabelText('Sentence 2 of 2')).toBeInTheDocument();
  });

  it('refuses a set that arrived with its answer key on it', async () => {
    // Stripping the key here would leave a runner that works, an exercise that is
    // pointless, and nothing on any screen to say the answers were ever sent.
    renderSolver(
      mockApi({
        content: {
          ...PROJECTION,
          rows: [{ ...PROJECTION.rows[0], text: 'at kommer' }],
        },
      }),
    );

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says so rather than drawing an empty board when no sentence is finished', async () => {
    renderSolver(mockApi({ content: { ...PROJECTION, rows: [] } }));

    expect(await screen.findByText(/Nothing to solve here yet/)).toBeInTheDocument();
  });

  it('tells a refusal apart from a network failure', async () => {
    renderSolver(mockApi({ checkStatus: 422 }));
    await screen.findByText('«Jeg kommer», sa han.');

    await userEvent.click(screen.getByRole('button', { name: 'at' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place in Subjunksjon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1/2)' }));

    expect(await screen.findByText('This sentence is already finished.')).toBeInTheDocument();
  });
});
