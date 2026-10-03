import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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

import { SortIntoBucketsSolver } from './sort-into-buckets-solver';

/** The board as the engine deals it: zones and tiles, and no trace of the key. */
const PROJECTION = {
  instruction: 'Sorter ordene.',
  buckets: [
    { id: 'b-en', label: 'en' },
    { id: 'b-ei', label: 'ei' },
  ],
  items: [
    { id: 'i1', text: 'bok' },
    { id: 'i2', text: 'bil' },
    { id: 'i3', text: 'sol' },
  ],
  settings: { showRemaining: false, revealKey: true, attempts: 2, threshold: 70 },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'sort_into_buckets',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

const scored = (details: Record<string, unknown>, correct = false) => ({
  attemptId: 'att-1',
  correct,
  score: 33,
  requiresReview: false,
  feedback: { summary: '' },
  details,
});

const unplaced = (itemId: string) => ({
  itemId,
  chosenBucketId: null,
  correct: false,
  firstCorrect: false,
  firstAnswer: null,
});

/** `bil` right, `bok` wrong in `en`, `sol` placed in `ei` and right. */
const OPEN = {
  totalItems: 3,
  passedItems: 2,
  correctNow: 2,
  attempt: 1,
  checksLeft: 1,
  closed: false,
  revealed: false,
  locked: ['i2', 'i3'],
  rules: [],
  items: [
    {
      itemId: 'i1',
      chosenBucketId: 'b-en',
      correct: false,
      firstCorrect: false,
      firstAnswer: 'b-en',
      explanation: 'bok is a feminine noun.',
    },
    {
      itemId: 'i2',
      chosenBucketId: 'b-en',
      correct: true,
      firstCorrect: true,
      firstAnswer: 'b-en',
    },
    {
      itemId: 'i3',
      chosenBucketId: 'b-ei',
      correct: true,
      firstCorrect: true,
      firstAnswer: 'b-ei',
    },
  ],
};

const CLOSED = {
  ...OPEN,
  attempt: 2,
  checksLeft: 0,
  closed: true,
  revealed: true,
  rules: [{ bucketId: 'b-ei', rule: 'Feminine nouns.' }],
  items: [
    {
      itemId: 'i1',
      chosenBucketId: 'b-en',
      correct: false,
      firstCorrect: false,
      firstAnswer: 'b-en',
      correctBucketId: 'b-ei',
      why: 'bok is feminine.',
    },
    { ...OPEN.items[1]!, correctBucketId: 'b-en' },
    { ...OPEN.items[2]!, correctBucketId: 'b-ei' },
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
) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SortIntoBucketsSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const zone = (label: string) => screen.getByRole('group', { name: new RegExp(`^${label},`) });

/** Tap a tile, then the zone it goes in. */
async function put(tileName: string, zoneLabel: string) {
  await userEvent.click(screen.getByRole('button', { name: tileName }));
  await userEvent.click(zone(zoneLabel));
}

/** Put the three tiles down the way OPEN judges them, and hand the board in. */
async function placeAndCheck() {
  await put('bok', 'en');
  await put('bil', 'en');
  await put('sol', 'ei');
  await userEvent.click(screen.getByRole('button', { name: 'Check (3)' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SortIntoBucketsSolver', () => {
  it('opens an attempt and draws the board the engine dealt', async () => {
    renderSolver(mockApi());

    expect(await screen.findByRole('button', { name: 'bok' })).toBeInTheDocument();
    expect(screen.getByText('Sorter ordene.')).toBeInTheDocument();
    expect(zone('en')).toBeInTheDocument();
  });

  it('refuses a board that arrived with its answer key on it', async () => {
    renderSolver(
      mockApi({
        content: { ...PROJECTION, items: [{ id: 'i1', text: 'bok', bucketId: 'b-en' }] },
      }),
    );

    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('sends the placements and nothing else, and draws the verdict that came back', async () => {
    const api = mockApi();
    renderSolver(api);
    await screen.findByRole('button', { name: 'bok' });

    await placeAndCheck();

    await waitFor(() =>
      expect(
        within(zone('en')).getByText('bok is a feminine noun.', { exact: false }),
      ).toBeVisible(),
    );

    const submitted = (api.bodies[0] as { submittedAnswer: Record<string, unknown> })
      .submittedAnswer;
    expect(submitted['placements']).toEqual(
      expect.arrayContaining([
        { itemId: 'i1', bucketId: 'b-en' },
        { itemId: 'i2', bucketId: 'b-en' },
        { itemId: 'i3', bucketId: 'b-ei' },
      ]),
    );
    expect(submitted).not.toHaveProperty('reveal');
    // Which check this is, which tiles are frozen and where each stood the first time round
    // are the attempt's own facts; a client that stated them would be buying itself a go.
    expect(submitted).not.toHaveProperty('attempt');
    expect(submitted).not.toHaveProperty('locked');
    expect(submitted).not.toHaveProperty('firstAnswers');
  });

  it('lets a student check after placing a single tile (plan 66 Q5-A)', async () => {
    const api = mockApi();
    renderSolver(api);
    await screen.findByRole('button', { name: 'bok' });

    await put('bil', 'en');
    await userEvent.click(screen.getByRole('button', { name: 'Check (1)' }));

    await waitFor(() => expect(api.bodies).toHaveLength(1));
    expect(
      (api.bodies[0] as { submittedAnswer: { placements: unknown[] } }).submittedAnswer.placements,
    ).toEqual([{ itemId: 'i2', bucketId: 'b-en' }]);
  });

  it('reports progress once, on the first check', async () => {
    const onChecked = vi.fn();
    renderSolver(mockApi({ checks: [scored(OPEN), scored(CLOSED)] }), onChecked);
    await screen.findByRole('button', { name: 'bok' });

    await placeAndCheck();
    await waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /Try the wrong ones again/ }));
    await put('bok', 'ei');
    await userEvent.click(screen.getByRole('button', { name: 'Check (1)' }));

    await waitFor(() => expect(screen.getByText(/Attempt 2/)).toBeInTheDocument());
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('returns exactly the wrong tiles to the pool on a retry, and moves the attempt on (AC-S5)', async () => {
    renderSolver(mockApi());
    await screen.findByRole('button', { name: 'bok' });
    await placeAndCheck();
    await screen.findByText(/Attempt 1 of 2/);

    await userEvent.click(screen.getByRole('button', { name: 'Try the wrong ones again (1)' }));

    // `bok` is back in the pool; `bil` and `sol` are where the server froze them, and stay.
    expect(screen.getByRole('button', { name: 'bok' })).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(zone('en')).getByRole('button', { name: 'bil, in en, correct' }),
    ).toBeInTheDocument();
    expect(
      within(zone('ei')).getByRole('button', { name: 'sol, in ei, correct' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('bok is a feminine noun.', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText(/Attempt 2 of 2/)).toBeInTheDocument();
  });

  it('spends no check on «Show the correct placement» and closes the board with the key (AC-S8)', async () => {
    const api = mockApi({ checks: [scored(OPEN), scored(CLOSED)] });
    renderSolver(api);
    await screen.findByRole('button', { name: 'bok' });
    await placeAndCheck();
    await screen.findByText(/Attempt 1 of 2/);

    await userEvent.click(screen.getByRole('button', { name: 'Show the correct placement' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument());
    const revealed = (api.bodies[1] as { submittedAnswer: Record<string, unknown> })
      .submittedAnswer;
    expect(revealed['reveal']).toBe(true);
    // The key arrives with the closing check, and only then.
    expect(
      within(zone('ei')).getByRole('button', { name: 'bok, belongs in ei' }),
    ).toBeInTheDocument();
    expect(within(zone('ei')).getByText('Feminine nouns.')).toBeInTheDocument();
  });

  it('offers no further check once the server says the board is closed (AC-S6)', async () => {
    renderSolver(mockApi({ checks: [scored(CLOSED)] }));
    await screen.findByRole('button', { name: 'bok' });
    await placeAndCheck();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Try the wrong/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Check/ })).not.toBeInTheDocument();
  });

  it('shows the done screen with the first-check score, and starts over on request', async () => {
    const api = mockApi({ checks: [scored(CLOSED)] });
    renderSolver(api);
    await screen.findByRole('button', { name: 'bok' });
    await placeAndCheck();
    await userEvent.click(await screen.findByRole('button', { name: 'Finish' }));

    expect(screen.getByText('2 of 3 right on the first check.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(await screen.findByRole('button', { name: 'bok' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('tells a refusal apart from a request that never landed', async () => {
    const { unmount } = renderSolver(mockApi({ submitStatus: 422 }));
    await screen.findByRole('button', { name: 'bok' });
    await placeAndCheck();

    expect(await screen.findByText('This board is already finished.')).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    renderSolver(mockApi({ submitStatus: 502 }));
    await screen.findByRole('button', { name: 'bok' });
    await placeAndCheck();

    // A 502 may still have landed — the engine takes a submission before it scores it —
    // so the attempt is asked about, and it says the check is in.
    expect(await screen.findByText('This board is already finished.')).toBeInTheDocument();
  });
});
