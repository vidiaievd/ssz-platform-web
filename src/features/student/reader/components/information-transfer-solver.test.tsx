import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  infDetails,
  dealInf,
} from '@/features/student/exercises/runner/information-transfer-test-kit';
import { SAMPLE_FIELD_IDS, sampleContent } from '@/lib/shared-kernel/information-transfer';

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

import { InformationTransferSolver } from './information-transfer-solver';

const [DATO, KLOK, ROM, PRIS, TLF, NAVN] = SAMPLE_FIELD_IDS;
const EX = sampleContent('text');
const PROJECTION = dealInf(EX);

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'information_transfer',
  targetLanguage: 'nb',
  difficultyLevel: 'A2',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

/** What the engine's validator returns for these answers, from the same kernel `check`. */
function scored(
  answers: Record<string, string>,
  attempt = 1,
  firstValues?: Record<string, string>,
) {
  const details = infDetails(
    EX,
    answers,
    attempt,
    firstValues === undefined ? {} : { firstValues },
  );
  return {
    attemptId: 'att-1',
    correct: details.correctNow === details.totalItems,
    score: details.pct,
    requiresReview: false,
    feedback: { summary: '' },
    details,
  };
}

/** One cell right (the name), five typed wrong: the first check fails, the blank stays open. */
const MOSTLY_WRONG = {
  [DATO]: 'x',
  [KLOK]: 'x',
  [ROM]: '2',
  [PRIS]: 'x',
  [TLF]: 'x',
  [NAVN]: 'Anne Lise',
};
const ALL_CORRECT = {
  [DATO]: '3. mars',
  [KLOK]: '17:30',
  [ROM]: '204',
  [PRIS]: '450',
  [TLF]: '22 45 67 89',
  [NAVN]: 'Anne Lise',
};

interface ApiOptions {
  submits?: unknown[];
  submitStatuses?: number[];
  resumable?: boolean;
  started?: unknown;
  display?: unknown;
}

function mockApi(options: ApiOptions = {}) {
  const submits = options.submits ?? [scored(MOSTLY_WRONG)];
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
        templateCode: 'information_transfer',
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
          <InformationTransferSolver exerciseId="ex-1" language="nb" {...props} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const starts = (api: ReturnType<typeof mockApi>) =>
  api.mock.calls.filter(
    ([url, init]) => !String(url).endsWith('/submit') && init?.method === 'POST',
  );

const field = (name: string) =>
  screen.findByRole('textbox', { name: new RegExp(`^${name}(,.*)?$`) });

/** Press start, fill the blank the way MOSTLY_WRONG says, and check it. */
async function startAndCheck() {
  await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
  await userEvent.type(await field('Dato'), 'x');
  await userEvent.type(await field('Klokkeslett'), 'x');
  await userEvent.type(await field('Rom'), '2');
  await userEvent.type(await field('Pris'), 'x');
  await userEvent.type(await field('Telefon'), 'x');
  await userEvent.type(await field('Kontaktperson'), 'Anne Lise');
  await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InformationTransferSolver — the card', () => {
  it('opens on the card, which starts nothing until pressed', async () => {
    const api = mockApi();
    renderSolver(api, { title: 'Kurs' });

    expect(await screen.findByText('Reading · 6 fields · about 5 min')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kurs' })).toBeInTheDocument();
    expect(starts(api)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await field('Rom')).toBeInTheDocument();
    expect(starts(api)).toHaveLength(1);
  });

  it('steps aside for an attempt the engine resumes', async () => {
    renderSolver(mockApi({ resumable: true }));
    expect(await field('Rom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('puts the blank back as the last check left it when the engine resumes it', async () => {
    const back = scored(MOSTLY_WRONG).details;
    renderSolver(mockApi({ resumable: true, started: { ...STARTED, boardCheck: back } }));

    expect(await field('Rom')).toHaveValue('2');
    expect(await field('Kontaktperson')).toHaveValue('Anne Lise');
    expect(
      await screen.findByRole('button', { name: /^Fix 5 fields · attempt 2 of 2$/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check the answers' })).toBeNull();
  });

  it('does not report the first check a second time after a resume', async () => {
    const onChecked = vi.fn();
    renderSolver(
      mockApi({
        resumable: true,
        started: { ...STARTED, boardCheck: scored(MOSTLY_WRONG).details },
      }),
      { onChecked },
    );
    await screen.findByRole('button', { name: /^Fix/ });
    expect(onChecked).not.toHaveBeenCalled();
  });

  it('refuses a card drawn from a document that carries the key', async () => {
    const leaky = JSON.parse(JSON.stringify(PROJECTION));
    leaky.fields[0].expected = ['3. mars'];
    renderSolver(mockApi({ display: leaky }));
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });
});

describe('InformationTransferSolver — checking', () => {
  it('sends only the filled cells by field id and draws what the server said', async () => {
    const api = mockApi({ submits: [scored(MOSTLY_WRONG)] });
    const onChecked = vi.fn();
    renderSolver(api, { onChecked });
    await startAndCheck();

    expect(await screen.findByText('Try again')).toBeInTheDocument();
    expect(api.bodies).toHaveLength(1);
    expect(api.bodies[0]!.submittedAnswer).toEqual({ cells: MOSTLY_WRONG });
    expect(onChecked).toHaveBeenCalledTimes(1);
    expect(onChecked).toHaveBeenCalledWith(false);
  });

  it('retry empties exactly the cells not counted, freezes the rest, and reports once', async () => {
    const api = mockApi({
      submits: [scored(MOSTLY_WRONG), scored(ALL_CORRECT, 2, MOSTLY_WRONG)],
    });
    const onChecked = vi.fn();
    renderSolver(api, { onChecked });
    await startAndCheck();

    await userEvent.click(await screen.findByRole('button', { name: /^Fix 5 fields/ }));

    const wrong = await field('Rom');
    expect(wrong).toHaveValue('');
    expect(wrong).toBeEnabled();
    // The name was right: it stays, and cannot be changed.
    const kept = await field('Kontaktperson');
    expect(kept).toHaveValue('Anne Lise');
    expect(kept).toBeDisabled();

    await userEvent.type(wrong, '204');
    await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));

    expect(api.bodies).toHaveLength(2);
    expect(api.bodies[1]!.submittedAnswer.cells).toMatchObject({
      [ROM]: '204',
      [NAVN]: 'Anne Lise',
    });
    // The first check is the only one the progress signal is built on.
    expect(onChecked).toHaveBeenCalledTimes(1);
    // The blank closed: the way on is a new round.
    expect(await screen.findByRole('button', { name: 'New round' })).toBeInTheDocument();
  });

  it('«New round» opens a new attempt with an empty blank', async () => {
    const api = mockApi({
      submits: [scored(ALL_CORRECT)],
    });
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    for (const [name, value] of [
      ['Dato', '3. mars'],
      ['Klokkeslett', '17:30'],
      ['Rom', '204'],
      ['Pris', '450'],
      ['Telefon', '22 45 67 89'],
      ['Kontaktperson', 'Anne Lise'],
    ] as const) {
      await userEvent.type(await field(name), value);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));
    await userEvent.click(await screen.findByRole('button', { name: 'New round' }));

    expect(starts(api)).toHaveLength(2);
    expect(await field('Rom')).toHaveValue('');
    expect(await field('Rom')).toBeEnabled();
  });

  it('says the blank is already finished on a 422', async () => {
    renderSolver(mockApi({ submitStatuses: [422] }));
    await startAndCheck();
    expect(await screen.findByText('This exercise is already finished.')).toBeInTheDocument();
  });

  it('closes on an all-correct first check, with the transcript the server sent', async () => {
    const sent = {
      ...scored(ALL_CORRECT),
      audioTranscript: { transcript: 'Hei', translation: '' },
    };
    const api = mockApi({ submits: [sent] });
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await userEvent.type(await field('Rom'), '204');
    await userEvent.click(screen.getByRole('button', { name: 'Check the answers' }));
    expect(await screen.findByRole('button', { name: 'New round' })).toBeInTheDocument();
  });
});
