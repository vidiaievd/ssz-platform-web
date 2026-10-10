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
      Reload
    </button>
  ),
  LearningSkeleton: () => <div>loading</div>,
}));

import { MinimalPairsSolver } from './minimal-pairs-solver';

/** The set as content-service and the engine project it: no pair, no word, no clip. */
const PROJECTION = {
  title: 'Hører du kj eller sj?',
  instruction: 'Trykk på ordet du hørte.',
  language: 'nb',
  contrast: { label: 'kj / sj', ipa: 'ç – ʃ' },
  set: { probes: 1, playsPerProbe: 2, autoplay: false },
  feedback: {
    immediate: true,
    abCompare: true,
    showSpelling: 'afterAnswer',
    showGloss: 'afterAnswer',
    showIpa: false,
    secondChance: false,
  },
};

const started = (attemptId: string) => ({
  attemptId,
  templateCode: 'minimal_pairs',
  targetLanguage: 'nb',
  difficultyLevel: 'A2',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
  pickedOptions: [],
});

const probe = {
  n: 1,
  total: 1,
  questionId: 'p1',
  clip: {
    url: 'https://media.test/p1.mp3',
    expiresAt: '2026-10-09T12:00:00Z',
    durationMs: 700,
    provenance: 'studio',
    dialect: '',
  },
  options: [{ id: 'w1' }, { id: 'w2' }],
  state: { tries: 0, maxTries: 1, closed: false },
  closedProbes: [],
};

const answered = {
  attemptId: 'att-1',
  templateCode: 'minimal_pairs',
  answered: 1,
  total: 1,
  routedForReview: false,
  result: {
    questionId: 'p1',
    n: 1,
    optionId: 'w2',
    correct: true,
    closed: true,
    tries: 1,
    triesLeft: 0,
    firstCorrect: true,
    keyOptionId: 'w2',
    options: [
      { id: 'w1', text: 'kjære' },
      { id: 'w2', text: 'skjære' },
    ],
  },
};

const submitted = {
  attemptId: 'att-1',
  correct: true,
  score: 100,
  requiresReview: false,
  feedback: { summary: '' },
  details: {
    right: 1,
    total: 1,
    score: 100,
    passed: true,
    passPct: 75,
    memory: 'contrast',
    pairs: [
      { pairId: 'a', words: ['kjære', 'skjære'], played: 1, correct: 1, clips: ['u1', 'u2'] },
    ],
  },
};

interface ApiOptions {
  resumable?: boolean;
  /** Each start in order — a body, or a refusal; the last repeats. */
  starts?: Array<{ status: number; body: unknown }>;
}

function mockApi(options: ApiOptions = {}) {
  const starts = options.starts ?? [
    { status: 200, body: started('att-1') },
    { status: 200, body: started('att-2') },
  ];
  let startIndex = 0;
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/runner')) {
      return json({
        id: 'ex-1',
        templateCode: 'minimal_pairs',
        targetLanguage: 'nb',
        content: PROJECTION,
      });
    }
    if (path.endsWith('/items')) return json(probe);
    if (path.endsWith('/answers')) return json(answered);
    if (path.endsWith('/submit')) return json(submitted);
    if (init?.method === undefined) {
      return json({ attempt: null, ...(options.resumable === true ? { resumable: true } : {}) });
    }
    const start = starts[Math.min(startIndex, starts.length - 1)]!;
    startIndex += 1;
    return json(start.body, start.status);
  });
  return fetchMock;
}

function renderSolver(api: ReturnType<typeof mockApi>, onChecked?: (ok: boolean | null) => void) {
  vi.stubGlobal('fetch', api);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MinimalPairsSolver
          exerciseId="ex-1"
          language="nb"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const startCalls = (api: ReturnType<typeof mockApi>) =>
  api.mock.calls.filter(
    ([url, init]) => /\/attempts$/.test(String(url)) && init?.method === 'POST',
  );

beforeEach(() => {
  // jsdom plays nothing; a resolved `play()` stands in for a browser that let the clip start.
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MinimalPairsSolver', () => {
  it('opens on the card, which starts nothing until pressed (MP-R16)', async () => {
    const api = mockApi();
    renderSolver(api);

    expect(await screen.findByText('kj / sj · 1 probe · about 1 min')).toBeInTheDocument();
    expect(startCalls(api)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('button', { name: /^A/ })).toBeInTheDocument();
    expect(startCalls(api)).toHaveLength(1);
  });

  it('walks a sitting against the engine: items, answer, submit, verdict reported', async () => {
    const api = mockApi();
    const onChecked = vi.fn();
    renderSolver(api, onChecked);

    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await userEvent.click(await screen.findByRole('button', { name: /^B/ }));
    expect(await screen.findByText('Correct.')).toBeInTheDocument();

    const answers = api.mock.calls.find(([url]) => String(url).endsWith('/answers'));
    expect(JSON.parse(String(answers?.[1]?.body))).toEqual({ questionId: 'p1', optionId: 'w2' });

    await userEvent.click(screen.getByRole('button', { name: 'See the result' }));
    expect(await screen.findByText('100% correct · the requirement is 75%')).toBeInTheDocument();
    expect(onChecked).toHaveBeenCalledWith(true);
  });

  it('steps aside for a sitting the engine resumes (MP-R15)', async () => {
    const api = mockApi({ resumable: true });
    renderSolver(api);

    expect(await screen.findByRole('button', { name: /^A/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(startCalls(api)).toHaveLength(1);
  });

  it('starts a new attempt for «New round», and says so when no round is left (MP-R14)', async () => {
    const api = mockApi({
      starts: [
        { status: 200, body: started('att-1') },
        { status: 422, body: { error: 'spent', code: 'MP_SITTINGS_SPENT', allowed: 1 } },
      ],
    });
    renderSolver(api);

    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await userEvent.click(await screen.findByRole('button', { name: /^B/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'See the result' }));
    await userEvent.click(await screen.findByRole('button', { name: 'New round' }));

    expect(await screen.findByText('You have used your one round.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New round' })).toBeDisabled();
    expect(startCalls(api)).toHaveLength(2);
  });

  it('opens a fresh sitting on «New round» when one is allowed', async () => {
    const api = mockApi();
    renderSolver(api);

    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await userEvent.click(await screen.findByRole('button', { name: /^B/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'See the result' }));
    await userEvent.click(await screen.findByRole('button', { name: 'New round' }));

    // The new attempt's first probe, its buttons lettered again.
    await waitFor(() => expect(screen.getByRole('button', { name: /^A/ })).toBeEnabled());
    const items = api.mock.calls.filter(([url]) => String(url).endsWith('/items'));
    expect(String(items.at(-1)?.[0])).toContain('/attempts/att-2/items');
  });

  it('keeps the card and says why when the sittings are already used', async () => {
    const api = mockApi({
      starts: [{ status: 422, body: { error: 'spent', code: 'MP_SITTINGS_SPENT', allowed: 3 } }],
    });
    renderSolver(api);

    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('You have used all 3 rounds.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('refuses a card drawn from a document that carries the key', async () => {
    const api = mockApi();
    api.mockImplementation(async (url: RequestInfo | URL) =>
      String(url).endsWith('/runner')
        ? new Response(
            JSON.stringify({
              templateCode: 'minimal_pairs',
              content: { ...PROJECTION, pairs: [] },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : new Response(JSON.stringify({ attempt: null }), { status: 200 }),
    );
    renderSolver(api);
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
