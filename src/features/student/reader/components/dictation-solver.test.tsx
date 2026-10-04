import { StrictMode, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
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

import { DictationSolver } from './dictation-solver';

/** Two sentences as the engine deals them: ids, and no trace of the key. */
const PROJECTION = {
  instruction: 'Hør på opptaket og skriv setningene.',
  mode: 'segments',
  segments: [{ id: 's1' }, { id: 's2' }],
  settings: { attempts: 2, hints: true, revealKey: true, showWordCount: false },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'dictation',
  targetLanguage: 'nb',
  difficultyLevel: 'A2',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
  segmentStates: [],
};

const state = (segmentId: string, over: Record<string, unknown> = {}) => ({
  segmentId,
  checks: 0,
  firstScore: null,
  firstPassed: null,
  passed: false,
  revealed: false,
  closed: false,
  lastText: '',
  lastCheckAt: null,
  first: null,
  last: null,
  key: null,
  transcriptSlice: null,
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

const OPS = [
  { k: 'eq', i: 0, w: 'Hun', p: '' },
  {
    k: 'sub',
    i: 1,
    n: 1,
    wrote: 'bor',
    expected: 'bodde',
    p: '.',
    cls: 'wrong',
    near: false,
    focus: false,
  },
];
const WORDS = { total: 2, exact: 1, near: 0, wrong: 1, missing: 0, extra: 0 };

/** s1: «Hun bor» for «Hun bodde.» */
const FAILED = {
  segmentId: 's1',
  pct: 50,
  passed: false,
  words: WORDS,
  ops: OPS,
  nearCredit: false,
  focus: [],
  why: 'It happened yesterday.',
  attempt: 1,
  checksLeft: 1,
  closed: false,
  revealed: false,
  segments: [
    state('s1', {
      checks: 1,
      firstScore: 0.5,
      firstPassed: false,
      lastText: 'Hun bor',
      last: { pct: 50, words: WORDS, ops: OPS },
    }),
    state('s2'),
  ],
  complete: false,
  attemptPct: 25,
  attemptPassed: false,
};

const PASSED_S1 = {
  ...FAILED,
  pct: 100,
  passed: true,
  words: { ...WORDS, exact: 2, wrong: 0 },
  ops: [
    { k: 'eq', i: 0, w: 'Hun', p: '' },
    { k: 'eq', i: 1, w: 'bodde', p: '.' },
  ],
  why: undefined,
  attempt: 1,
  closed: true,
  transcriptSlice: 'Hun bodde.',
  segments: [
    state('s1', { checks: 1, firstScore: 1, firstPassed: true, passed: true, closed: true }),
    state('s2'),
  ],
  attemptPct: 50,
};

const REVEALED_S1 = {
  ...FAILED,
  ops: [],
  why: undefined,
  closed: true,
  revealed: true,
  key: { text: 'Hun bodde.', why: 'It happened yesterday.', focus: [] },
  segments: [
    state('s1', {
      checks: 1,
      firstScore: 0.5,
      firstPassed: false,
      revealed: true,
      closed: true,
      last: { pct: 50, words: WORDS, ops: OPS },
      key: { text: 'Hun bodde.', why: 'It happened yesterday.', focus: [] },
    }),
    state('s2'),
  ],
};

const PASSED_S2_COMPLETE = {
  ...PASSED_S1,
  segmentId: 's2',
  segments: [
    PASSED_S1.segments[0],
    state('s2', { checks: 1, firstScore: 1, firstPassed: true, passed: true, closed: true }),
  ],
  complete: true,
  attemptPct: 100,
  attemptPassed: true,
};

interface ApiOptions {
  started?: Record<string, unknown>;
  /** Each submit in order; the last one repeats. */
  submits?: unknown[];
  /** Status of each submit in order; 200 where not given. */
  submitStatuses?: number[];
  resumable?: boolean;
  /** The display projection the card is drawn from. */
  display?: Record<string, unknown>;
}

function mockApi(options: ApiOptions = {}) {
  const submits = options.submits ?? [scored(FAILED)];
  const bodies: Array<{ submittedAnswer: unknown }> = [];
  let handed = 0;
  let calls = 0;

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
        templateCode: 'dictation',
        targetLanguage: 'nb',
        content: options.display ?? {
          ...PROJECTION,
          audio: { enabled: true, duration: 26, settings: { plays: 3 } },
        },
        expectedAnswers: {},
      });
    }

    if (path.endsWith('/submit')) {
      if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body));
      const status = options.submitStatuses?.[calls] ?? 200;
      calls += 1;
      if (status !== 200) return json({ error: 'nope' }, status);
      const body = submits[Math.min(handed, submits.length - 1)];
      handed += 1;
      return json(body);
    }

    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) return json({ status: 'IN_PROGRESS' });
      return json({ attempt: null, ...(options.resumable === true ? { resumable: true } : {}) });
    }

    return json({ ...STARTED, ...options.started });
  });

  return Object.assign(fetchMock, { bodies });
}

function renderSolver(
  fetchMock: ReturnType<typeof mockApi>,
  props: { onChecked?: (ok: boolean | null) => void; title?: string } = {},
  wrap: (node: ReactElement) => ReactElement = (node) => node,
) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    wrap(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <DictationSolver exerciseId="ex-1" language="nb" {...props} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const starts = (api: ReturnType<typeof mockApi>) =>
  api.mock.calls.filter(
    ([url, init]) => !String(url).endsWith('/submit') && init?.method === 'POST',
  );

/** Press «Start», write the sentence and check it. */
async function startAndCheck(typed = 'Hun bor') {
  await userEvent.click(await screen.findByRole('button', { name: /Start the dictation/ }));
  await userEvent.type(await screen.findByRole('textbox', { name: 'Sentence 1' }), typed);
  await userEvent.click(screen.getByRole('button', { name: 'Check' }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DictationSolver — the start card (Q6-A)', () => {
  it('opens on the card, which starts nothing until pressed', async () => {
    const api = mockApi();
    renderSolver(api, { title: 'Kjøkkenet' });

    expect(await screen.findByText('2 sentences · 0:26 · 3 playbacks')).toBeInTheDocument();
    expect(screen.getByText('Kjøkkenet')).toBeInTheDocument();
    expect(starts(api)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: /Start the dictation/ }));
    expect(await screen.findByRole('textbox', { name: 'Sentence 1' })).toBeInTheDocument();
    expect(starts(api)).toHaveLength(1);
  });

  it('steps aside for an attempt the engine resumes', async () => {
    const api = mockApi({
      resumable: true,
      started: {
        segmentStates: [
          state('s1', { checks: 1, passed: true, closed: true, firstPassed: true, firstScore: 1 }),
          state('s2', { checks: 1, firstScore: 0, firstPassed: false, lastText: 'Han gikk' }),
        ],
      },
    });
    renderSolver(api);

    // On the first sentence still open, its last checked text back in the field, at the
    // check after the last (plan 68 §8, 3).
    const field = await screen.findByRole('textbox', { name: 'Sentence 2' });
    expect(field).toHaveValue('Han gikk');
    expect(screen.getByText('Attempt 2 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start the dictation/ })).toBeNull();
  });

  it('refuses a card drawn from a document that carries the key', async () => {
    renderSolver(mockApi({ display: { ...PROJECTION, marking: { caseSensitive: false } } }));
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});

describe('DictationSolver — sentence by sentence', () => {
  it('sends the sentence id and the text as typed, and draws the verdict', async () => {
    const api = mockApi();
    renderSolver(api);
    await startAndCheck();

    expect(await screen.findByText('1 of 2 words right.', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText('It happened yesterday.')).toBeInTheDocument();
    expect(api.bodies[0]?.submittedAnswer).toEqual({ segmentId: 's1', text: 'Hun bor' });
  });

  it('a retry keeps the text and moves the attempt on (AC-R8)', async () => {
    renderSolver(mockApi());
    await startAndCheck();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    const field = screen.getByRole('textbox', { name: 'Sentence 1' });
    expect(field).toHaveValue('Hun bor');
    expect(field).toBeEnabled();
    expect(screen.getByText('Attempt 2 of 2')).toBeInTheDocument();
  });

  it('rests «Check» for two seconds after a check (Q4-A)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSolver(mockApi());

    await user.click(await screen.findByRole('button', { name: /Start the dictation/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Sentence 1' }), 'Hun bor');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('keeps the text and says so when the server finds the check too soon (429)', async () => {
    renderSolver(mockApi({ submitStatuses: [429] }));
    await startAndCheck();

    expect(await screen.findByText('Wait a moment before checking again.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Sentence 1' })).toHaveValue('Hun bor');
  });

  it('a reveal asks for the sentence with no text and shows it (AC-R9)', async () => {
    const api = mockApi({ submits: [scored(FAILED), scored(REVEALED_S1)] });
    renderSolver(api);
    await startAndCheck();
    await userEvent.click(await screen.findByRole('button', { name: 'Show the answer' }));

    expect(await screen.findByText('Hun bodde.', { selector: 'p' })).toBeInTheDocument();
    expect(api.bodies[1]?.submittedAnswer).toEqual({ segmentId: 's1', reveal: true });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next sentence' })).toBeInTheDocument();
  });

  it('goes on to the next sentence with an empty field', async () => {
    renderSolver(mockApi({ submits: [scored(PASSED_S1, true)] }));
    await startAndCheck('Hun bodde.');
    await userEvent.click(await screen.findByRole('button', { name: 'Next sentence' }));

    const field = screen.getByRole('textbox', { name: 'Sentence 2' });
    expect(field).toHaveValue('');
    expect(screen.queryByText(/^Attempt/)).toBeNull();
  });

  it('reports progress once, on the submit that closes the attempt, then shows the summary', async () => {
    const onChecked = vi.fn();
    const api = mockApi({ submits: [scored(PASSED_S1, true), scored(PASSED_S2_COMPLETE, true)] });
    renderSolver(api, { onChecked });

    await startAndCheck('Hun bodde.');
    await userEvent.click(await screen.findByRole('button', { name: 'Next sentence' }));
    expect(onChecked).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox', { name: 'Sentence 2' }), 'Hun bodde.');
    // The rest after a check is the sentence's, not the next one's (Q4-A is per sentence).
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));
    expect(onChecked).toHaveBeenCalledWith(true);
    expect(api.bodies[1]?.submittedAnswer).toEqual({ segmentId: 's2', text: 'Hun bodde.' });

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('2 of 2 sentences right')).toBeInTheDocument();
  });

  it('starts one attempt, not two, when effects run twice (React strict mode)', async () => {
    const api = mockApi();
    renderSolver(api, {}, (node) => <StrictMode>{node}</StrictMode>);

    await userEvent.click(await screen.findByRole('button', { name: /Start the dictation/ }));
    expect(await screen.findByRole('textbox', { name: 'Sentence 1' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(starts(api)).toHaveLength(1);
  });
});
