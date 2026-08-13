import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_FLOW } from '@/lib/shared-kernel/translate';

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

import { TranslateSolver } from './translate-solver';

/** The exercise as the server projects it: sentences, no accepted translations. */
const PROJECTION = {
  dir: 'to_target',
  langs: { explain: 'Russisk', target: 'Norsk' },
  format: 'set',
  note: '',
  items: [
    {
      id: 'i1',
      dir: 'to_target',
      source: 'Я живу в Тромсё три года.',
      sourceLang: 'Russisk',
      answerLang: 'Norsk',
      gloss: [],
    },
  ],
  flow: { ...DEFAULT_FLOW },
  exactPasses: true,
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'translate_to_target',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

/** Anything short of a hit on the key: routed, never marked wrong. */
const ROUTED = {
  attemptId: 'att-1',
  correct: false,
  score: null,
  requiresReview: true,
  feedback: { summary: 'Your answer has been submitted for review.' },
  details: { totalItems: 1, passedItems: 0, items: [{ itemId: 'i1', routing: 'teacher' }] },
};

const PASSED = {
  attemptId: 'att-1',
  correct: true,
  score: 100,
  requiresReview: false,
  feedback: { summary: 'Correct!' },
  details: { totalItems: 1, passedItems: 1, items: [{ itemId: 'i1', routing: 'pass' }] },
};

const LAST_ATTEMPT = {
  attempt: {
    id: 'att-0',
    exerciseId: 'ex-1',
    templateCode: 'translate_to_target',
    status: 'ROUTED_FOR_REVIEW',
    checkMode: 'PRACTICE',
    score: null,
    passed: null,
    answersRevealed: false,
    submittedAnswer: { answers: [{ itemId: 'i1', text: 'Jeg bor i Tromsø i tre år.' }] },
    validationDetails: null,
    submittedAt: '2026-08-12T10:00:00.000Z',
    scoredAt: null,
  },
};

function mockApi(
  responses: { submit?: unknown; startFails?: boolean; last?: unknown; started?: unknown } = {},
) {
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
    return new Response(
      JSON.stringify(path.endsWith('/submit') ? responses.submit : (responses.started ?? STARTED)),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
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
        <TranslateSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function answer(text: string) {
  const field = await screen.findByRole('textbox');
  await userEvent.type(field, text);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TranslateSolver', () => {
  it('opens an attempt and shows the sentence to translate', async () => {
    renderSolver(mockApi());

    expect(await screen.findByText('Я живу в Тромсё три года.')).toBeInTheDocument();
  });

  it('offers a retry when the attempt cannot be opened', async () => {
    renderSolver(mockApi({ startFails: true }));

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  /**
   * The exercise arriving unprojected means the accepted translations arrived with it.
   * Playing it would be handing the learner the answers.
   */
  it('refuses an exercise the server never projected', async () => {
    const stored = {
      ...PROJECTION,
      items: [{ id: 'i1', dir: 'to_target', source: 'Я живу в Тромсё три года.', gloss: [] }],
      exactPasses: undefined,
    };
    renderSolver(mockApi({ started: { ...STARTED, exerciseContent: stored } }));

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('will not hand in a sentence left empty, and says which', async () => {
    renderSolver(mockApi({ submit: PASSED }));

    await userEvent.click(await screen.findByRole('button', { name: 'Hand in to the teacher' }));

    expect(screen.getByText('1 sentence has no answer yet')).toBeInTheDocument();
  });

  it('sends one entry per sentence, in the shape the engine grades', async () => {
    const fetchMock = mockApi({ submit: PASSED });
    renderSolver(fetchMock);

    await answer('Jeg har bodd i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
      expect(call).toBeDefined();
      const body = JSON.parse(String((call![1] as RequestInit).body));
      expect(body.submittedAnswer).toEqual({
        answers: [{ itemId: 'i1', text: 'Jeg har bodd i Tromsø i tre år.' }],
      });
    });
  });

  it('says so when every sentence matched the key', async () => {
    renderSolver(mockApi({ submit: PASSED }));

    await answer('Jeg har bodd i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    expect(
      await screen.findByText('Every sentence matched — approved automatically'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Approved automatically')).toBeInTheDocument();
  });

  // The rule the template rests on: the machine may approve, and otherwise says
  // nothing about whether the translation was right.
  it('says the teacher has it, and never that the translation was wrong', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    expect(await screen.findByText('Handed in. Your teacher will look at it.')).toBeInTheDocument();
    expect(screen.queryByText(/wrong|incorrect|Not quite/i)).not.toBeInTheDocument();
  });

  it('reports a routed answer as judged by nobody yet', async () => {
    const onChecked = vi.fn();
    renderSolver(mockApi({ submit: ROUTED }), onChecked);

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(null));
  });

  it('stops accepting writing once the work is with the teacher', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    await screen.findByText('Handed in. Your teacher will look at it.');
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });

  it('puts a previous submission back, and says it was handed in', async () => {
    renderSolver(mockApi({ last: LAST_ATTEMPT }));

    expect(await screen.findByText('Handed in. Your teacher will look at it.')).toBeInTheDocument();
    expect(await screen.findByRole('textbox')).toHaveValue('Jeg bor i Tromsø i tre år.');
  });
});
