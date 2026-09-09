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

import { MultipleChoiceSolver } from './multiple-choice-solver';

/** The set as the server projects it: stems and option texts, and no trace of the key. */
const PROJECTION = {
  instruction: 'Velg formen som passer.',
  questions: [
    {
      id: 'q1',
      kind: 'grammar',
      stem: 'Han sa at han ___ syk.',
      options: [
        { id: 'a', text: 'er' },
        { id: 'b', text: 'var' },
      ],
    },
    {
      id: 'q2',
      kind: 'grammar',
      stem: 'Hun spurte om jeg ___ tid.',
      options: [
        { id: 'c', text: 'har' },
        { id: 'd', text: 'hadde' },
      ],
    },
  ],
  settings: {
    letters: true,
    layout: 'list',
    instant: false,
    retry: 'one',
    eliminate: false,
    progress: true,
  },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'multiple_choice',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
  pickedOptions: [],
};

/** One verdict, dosed the way the engine doses it — see `AnswerQuestionChoiceResultDto`. */
const verdict = (result: Record<string, unknown>) => ({
  attemptId: 'att-1',
  templateCode: 'multiple_choice',
  answered: 1,
  total: 2,
  result,
  routedForReview: false,
});

const SCORED = { attemptId: 'att-1', correct: true, score: 100, requiresReview: false };

interface ApiOptions {
  content?: unknown;
  /** Each hand-in in order; the last one repeats. */
  answers?: unknown[];
  answerStatus?: number;
  pickedOptions?: unknown[];
  submitFails?: boolean;
}

function mockApi(options: ApiOptions = {}) {
  const answers = options.answers ?? [
    verdict({
      questionId: 'q1',
      optionId: 'b',
      correct: true,
      attempt: 1,
      attemptsLeft: 1,
      closed: true,
      keyOptionId: 'b',
      why: 'Presens flyttes til preteritum.',
    }),
  ];
  const bodies: unknown[] = [];
  let handed = 0;

  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/answers')) {
      const status = options.answerStatus ?? 200;
      if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body));
      if (status !== 200) return json({ error: 'nope' }, status);
      const body = answers[Math.min(handed, answers.length - 1)];
      handed += 1;
      return json(body);
    }

    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) return json({ status: 'IN_PROGRESS' });
      return json({ attempt: null });
    }

    if (path.endsWith('/submit')) {
      if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body));
      if (options.submitFails) return json({ error: 'nope' }, 502);
      return json(SCORED);
    }

    return json({
      ...STARTED,
      ...(options.content === undefined ? {} : { exerciseContent: options.content }),
      ...(options.pickedOptions === undefined ? {} : { pickedOptions: options.pickedOptions }),
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
        <MultipleChoiceSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const option = (text: string) => screen.getByRole('button', { name: text });

afterEach(() => vi.unstubAllGlobals());

describe('MultipleChoiceSolver', () => {
  it('opens an attempt and shows the first question', async () => {
    renderSolver(mockApi());

    expect(await screen.findByRole('heading', { name: /Han sa at han/ })).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('sends the picked option and shows the verdict the server sent', async () => {
    const api = mockApi();
    renderSolver(api);
    await screen.findByRole('heading', { name: /Han sa at han/ });

    await userEvent.click(option('var'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Correct.')).toBeInTheDocument();
    expect(screen.getByText('Presens flyttes til preteritum.')).toBeInTheDocument();
    expect(api.bodies[0]).toEqual({ questionId: 'q1', optionId: 'b' });
  });

  /**
   * The rule the type turns on. The engine withholds `keyOptionId` while a try remains,
   * and this checks the runner does not fill it in — a `Try again` next to a highlighted
   * answer would be theatre.
   */
  it('a miss with a try left offers a retry and reveals nothing', async () => {
    const api = mockApi({
      answers: [
        verdict({
          questionId: 'q1',
          optionId: 'a',
          correct: false,
          attempt: 1,
          attemptsLeft: 1,
          closed: false,
          optionWhy: '«er» er presens.',
        }),
      ],
    });
    renderSolver(api);
    await screen.findByRole('heading', { name: /Han sa at han/ });

    await userEvent.click(option('er'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('«er» er presens.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(option('var')).toBeEnabled();
  });

  it('a retry spends a try and keeps what the 50/50 took away', async () => {
    const api = mockApi({
      answers: [
        verdict({
          questionId: 'q1',
          optionId: 'a',
          correct: false,
          attempt: 1,
          attemptsLeft: 1,
          closed: false,
          eliminated: ['a'],
        }),
      ],
    });
    renderSolver(api);
    await screen.findByRole('heading', { name: /Han sa at han/ });

    await userEvent.click(option('er'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByRole('button', { name: /Try again/ });
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    // Back in the picking state with nothing chosen — the counter belongs to a judged
    // question, so it goes with the judgement (README, "Actions").
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.queryByText('Attempt 2')).toBeNull();
    // Dimmed before the retry, still dimmed after it: a help already spent is not one to
    // hand out again.
    expect(option('er')).toBeDisabled();
  });

  it('«Show the answer» asks to be shown it rather than picking', async () => {
    const api = mockApi({
      answers: [
        verdict({
          questionId: 'q1',
          optionId: 'a',
          correct: false,
          attempt: 1,
          attemptsLeft: 1,
          closed: false,
        }),
        verdict({
          questionId: 'q1',
          optionId: '',
          correct: false,
          attempt: 1,
          attemptsLeft: 0,
          closed: true,
          keyOptionId: 'b',
          why: 'Presens flyttes til preteritum.',
        }),
      ],
    });
    renderSolver(api);
    await screen.findByRole('heading', { name: /Han sa at han/ });

    await userEvent.click(option('er'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByRole('button', { name: 'Show the answer' });
    await userEvent.click(screen.getByRole('button', { name: 'Show the answer' }));

    expect(await screen.findByText('Presens flyttes til preteritum.')).toBeInTheDocument();
    expect(api.bodies[1]).toEqual({ questionId: 'q1', optionId: null, reveal: true });
  });

  it('walks to the next question, then closes the set with an empty aggregate', async () => {
    const onChecked = vi.fn();
    const api = mockApi();
    renderSolver(api, onChecked);
    await screen.findByRole('heading', { name: /Han sa at han/ });

    await userEvent.click(option('var'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(await screen.findByRole('button', { name: /Next question/ }));

    expect(await screen.findByRole('heading', { name: /Hun spurte om jeg/ })).toBeInTheDocument();

    await userEvent.click(option('hadde'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(await screen.findByRole('button', { name: /Finish/ }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(true));
    // The picks are not sent back: which try a question was taken on is the score, and
    // the engine rebuilds the list from what it recorded (plan 53 §5).
    const submitted = api.bodies.at(-1) as { submittedAnswer: unknown };
    expect(submitted.submittedAnswer).toEqual({ answers: [] });
  });

  it('reopens a resumed set at the first question that is not closed', async () => {
    renderSolver(
      mockApi({
        pickedOptions: [
          {
            questionId: 'q1',
            picks: ['b'],
            eliminated: [],
            correct: true,
            closed: true,
            revealed: false,
          },
        ],
      }),
    );

    expect(await screen.findByRole('heading', { name: /Hun spurte om jeg/ })).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('a resumed question mid-budget comes back on the try it had reached', async () => {
    // Without this a reload after a miss would be a fresh first try at every question,
    // which is the cheapest possible full score.
    renderSolver(
      mockApi({
        pickedOptions: [
          {
            questionId: 'q1',
            picks: ['a'],
            eliminated: ['a'],
            correct: false,
            closed: false,
            revealed: false,
          },
        ],
      }),
    );

    await screen.findByRole('heading', { name: /Han sa at han/ });
    expect(option('er')).toBeDisabled();
    // The judgement is gone — the question reopens for its second try.
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
  });

  it('refuses a set that arrived with its answer key still on it', async () => {
    // Refusing rather than stripping: a runner that quietly worked would leave the retry
    // meaningless and nothing on any screen to say the key was sent (plan 53 §6.3).
    renderSolver(
      mockApi({
        content: {
          ...PROJECTION,
          questions: [
            {
              ...PROJECTION.questions[0],
              why: 'Presens flyttes til preteritum.',
            },
            PROJECTION.questions[1],
          ],
        },
      }),
    );

    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('tells a refusal apart from a network failure', async () => {
    renderSolver(mockApi({ answerStatus: 422 }));
    await screen.findByRole('heading', { name: /Han sa at han/ });

    await userEvent.click(option('var'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('This question is already finished.')).toBeInTheDocument();
  });
});
