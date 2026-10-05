import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  ALL_RIGHT,
  check,
  sampleContent,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
} from '@/lib/shared-kernel/inflection-table';

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

import { InflectionTableSolver } from './inflection-table-solver';

const EX = sampleContent();
const PROJECTION = toStudentProjection(toContent(EX), toExpectedAnswers(EX));

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'inflection_table',
  targetLanguage: 'nb',
  difficultyLevel: 'A2',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

/** What the engine's validator returns for these answers, from the same kernel `check`. */
function scored(answers: Record<string, string>, attempt = 1) {
  const result = check({ ex: EX, answers, attempt });
  return {
    attemptId: 'att-1',
    correct: result.correctNow === result.total,
    score: result.pct,
    requiresReview: false,
    feedback: { summary: '' },
    details: {
      totalItems: result.total,
      passedItems: result.correct,
      correctNow: result.correctNow,
      falsePositives: result.falsePositives,
      pct: result.pct,
      passed: result.passed,
      attempt: result.attempt,
      checksLeft: result.checksLeft,
      closed: result.closed,
      locked: result.locked,
      rows: result.rows,
      items: result.cells.map((cell) => ({
        itemId: cell.key,
        rowId: cell.rowId,
        slotId: cell.slotId,
        value: cell.value,
        correct: cell.ok,
        firstCorrect: cell.firstOk,
        firstAnswer: result.firstValues[cell.key] ?? '',
        ...(cell.why === undefined ? {} : { why: cell.why }),
      })),
    },
  };
}

/** What `startAndCheck` types: the definite singular wrong, the indefinite plural right. */
const TYPED = { 'r1:defSg': 'jobber', 'r1:indefPl': 'jobber' };

interface ApiOptions {
  submits?: unknown[];
  submitStatuses?: number[];
  resumable?: boolean;
  started?: unknown;
  display?: unknown;
}

function mockApi(options: ApiOptions = {}) {
  const submits = options.submits ?? [scored(TYPED)];
  const bodies: Array<{ submittedAnswer: { cells: Record<string, string> } }> = [];
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
        templateCode: 'inflection_table',
        targetLanguage: 'nb',
        content: options.display ?? PROJECTION,
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

    return json(options.started ?? STARTED);
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
          <InflectionTableSolver exerciseId="ex-1" language="nb" {...props} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const starts = (api: ReturnType<typeof mockApi>) =>
  api.mock.calls.filter(
    ([url, init]) => !String(url).endsWith('/submit') && init?.method === 'POST',
  );

/** The name gains «, correct» / «, wrong» once a check has marked the cell. */
const field = (row: string, slot: string) =>
  screen.findByRole('textbox', { name: new RegExp(`^${row}, ${slot}(, (correct|wrong))?$`) });

/** Press start, fill the table the way ONE_WRONG says, and check it. */
async function startAndCheck() {
  await userEvent.click(await screen.findByRole('button', { name: /Start the table/ }));
  await userEvent.type(await field('en jobb', 'Bestemt entall'), 'jobber');
  await userEvent.type(await field('en jobb', 'Ubestemt flertall'), 'jobber');
  await userEvent.click(screen.getByRole('button', { name: 'Check' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InflectionTableSolver — the card (Q4-A)', () => {
  it('opens on the card, which starts nothing until pressed', async () => {
    const api = mockApi();
    renderSolver(api, { title: 'Substantiv' });

    expect(await screen.findByText('12 cells · 4 lemmas')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Substantiv' })).toBeInTheDocument();
    expect(starts(api)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: /Start the table/ }));
    expect(await field('en jobb', 'Bestemt entall')).toBeInTheDocument();
    expect(starts(api)).toHaveLength(1);
  });

  it('steps aside for an attempt the engine resumes', async () => {
    renderSolver(mockApi({ resumable: true }));
    expect(await field('en jobb', 'Bestemt entall')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start the table/ })).toBeNull();
  });

  it('puts the table back as the last check left it when the engine resumes it', async () => {
    const back = scored(TYPED).details;
    const api = mockApi({ resumable: true, started: { ...STARTED, boardCheck: back } });
    renderSolver(api);

    // The cells as they were written, marked by that check, and the way on from here.
    expect(await field('en jobb', 'Bestemt entall')).toHaveValue('jobber');
    expect(await field('en jobb', 'Ubestemt flertall')).toHaveValue('jobber');
    expect(
      await screen.findByRole('button', { name: /Retry the wrong ones \(1\/2\)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('does not report the first check a second time after a resume', async () => {
    const onChecked = vi.fn();
    const api = mockApi({
      resumable: true,
      started: { ...STARTED, boardCheck: scored(TYPED).details },
    });
    renderSolver(api, { onChecked });

    await screen.findByRole('button', { name: /Retry the wrong ones/ });
    expect(onChecked).not.toHaveBeenCalled();
  });

  it('refuses a card drawn from a document that carries the key', async () => {
    const leaky = JSON.parse(JSON.stringify(PROJECTION));
    leaky.rows[0].cells.defSg = { mode: 'ask', value: 'jobben' };
    renderSolver(mockApi({ display: leaky }));
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start the table/ })).toBeNull();
  });
});

describe('InflectionTableSolver — checking', () => {
  it('sends only the filled cells and draws what the server said', async () => {
    const api = mockApi();
    const onChecked = vi.fn();
    renderSolver(api, { onChecked });
    await startAndCheck();

    expect(await screen.findByText('1 of 12 cells')).toBeInTheDocument();
    expect(api.bodies).toHaveLength(1);
    expect(api.bodies[0]!.submittedAnswer).toEqual({
      cells: { 'r1:defSg': 'jobber', 'r1:indefPl': 'jobber' },
    });
    expect(onChecked).toHaveBeenCalledTimes(1);
    expect(onChecked).toHaveBeenCalledWith(false);
  });

  it('retry empties exactly the wrong cells, keeps the right ones frozen, and reports once', async () => {
    const afterRetry = { ...ALL_RIGHT };
    const api = mockApi({
      submits: [scored(TYPED), scored(afterRetry, 2)],
    });
    const onChecked = vi.fn();
    renderSolver(api, { onChecked });
    await startAndCheck();

    // `jobber` is right in the plural and wrong in the definite singular.
    await userEvent.click(
      await screen.findByRole('button', { name: /Retry the wrong ones \(1\/2\)/ }),
    );

    const wrong = await field('en jobb', 'Bestemt entall');
    expect(wrong).toHaveValue('');
    expect(wrong).toBeEnabled();
    const kept = await field('en jobb', 'Ubestemt flertall');
    expect(kept).toHaveValue('jobber');
    expect(kept).toBeDisabled();

    await userEvent.type(wrong, 'jobben');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(api.bodies).toHaveLength(2);
    expect(api.bodies[1]!.submittedAnswer.cells).toMatchObject({
      'r1:defSg': 'jobben',
      'r1:indefPl': 'jobber',
    });
    // The first check is the only one the progress signal is built on.
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('says the table is already finished on a 422', async () => {
    renderSolver(mockApi({ submitStatuses: [422] }));
    await startAndCheck();
    expect(await screen.findByText('This exercise is already finished.')).toBeInTheDocument();
  });
});
