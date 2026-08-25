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

import { ShortAnswerSolver } from './short-answer-solver';

/** The set as the server projects it: prompts and passages, no elements, no model. */
const PROJECTION = {
  instruction: 'Svar med egne ord, én til tre setninger.',
  questions: [
    {
      id: 'sa1',
      kind: 'reading',
      prompt: 'Hvor lenge har Bartek jobbet i det samme firmaet?',
      passage: 'Bartek har jobbet som elektriker i det samme firmaet i tre år.',
    },
    { id: 'sa2', kind: 'reading', prompt: 'Hva vil Bartek gjerne ha i den nye jobben?' },
  ],
  settings: {
    passRule: 'all',
    passN: 2,
    minWords: 3,
    showBreakdown: true,
    showModel: 'onClose',
    aiStage: false,
    aiGrammar: true,
    teacherReview: 'flagged',
    progress: true,
  },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'short_answer',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

const answered = (questionId: string, verdict: 'pass' | 'partial' | 'fail') => ({
  attemptId: 'att-1',
  answered: questionId === 'sa1' ? 1 : 2,
  total: 2,
  result: {
    questionId,
    verdict,
    covered: verdict === 'pass' ? 1 : 0,
    total: 1,
    tooShort: false,
    hits: [{ id: 'e1', label: 'Tidsrommet: tre år', required: true, hit: verdict === 'pass' }],
    why: 'Svaret står i den første setningen.',
    ...(verdict === 'pass' ? {} : { model: 'Han har jobbet der i tre år.' }),
  },
  routedForReview: verdict !== 'pass',
});

const ROUTED = {
  attemptId: 'att-1',
  correct: false,
  score: null,
  requiresReview: true,
  feedback: { summary: 'Your answer has been submitted for review.' },
};

interface ApiOptions {
  content?: unknown;
  startFails?: boolean;
  /** Each hand-in in order; the last one repeats. */
  answers?: unknown[];
  answerStatus?: number;
  submit?: unknown;
  submitFails?: boolean;
  attemptStatus?: unknown;
  /** What the engine says is already handed in on the attempt it hands back. */
  answeredQuestions?: Array<{ questionId: string; text: string; verdict: string }>;
}

function mockApi(options: ApiOptions = {}) {
  const answers = options.answers ?? [answered('sa1', 'pass'), answered('sa2', 'partial')];
  let handed = 0;

  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/answers')) {
      const status = options.answerStatus ?? 200;
      if (status !== 200) return json({ error: 'nope' }, status);
      const body = answers[Math.min(handed, answers.length - 1)];
      handed += 1;
      return json(body);
    }

    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) {
        return json(options.attemptStatus ?? { status: 'IN_PROGRESS' });
      }
      return json({ attempt: null });
    }

    if (path.endsWith('/submit')) {
      if (options.submitFails) return json({ error: 'nope' }, 502);
      return json(options.submit ?? ROUTED);
    }

    if (options.startFails) return json({ error: 'nope' }, 502);
    return json({
      ...STARTED,
      ...(options.content === undefined ? {} : { exerciseContent: options.content }),
      ...(options.answeredQuestions === undefined
        ? {}
        : { answeredQuestions: options.answeredQuestions }),
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
        <ShortAnswerSolver
          exerciseId="ex-1"
          language="no"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function handIn(text: string) {
  await userEvent.type(screen.getByRole('textbox'), text);
  await userEvent.click(screen.getByRole('button', { name: /hand in answer/i }));
}

afterEach(() => vi.unstubAllGlobals());

describe('ShortAnswerSolver', () => {
  it('opens an attempt and shows the first question', async () => {
    renderSolver(mockApi());

    expect(
      await screen.findByRole('heading', { name: /Hvor lenge har Bartek jobbet/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('hands one question in and shows the verdict the server sent', async () => {
    const fetchMock = mockApi();
    renderSolver(fetchMock);
    await screen.findByRole('textbox');

    await handIn('Han har jobbet der i tre år.');

    const card = await screen.findByRole('status');
    expect(card).toHaveTextContent('Passed');
    expect(card).toHaveTextContent('Tidsrommet: tre år');

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/answers'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      questionId: 'sa1',
      text: 'Han har jobbet der i tre år.',
    });
  });

  it('moves on to the next question with the field cleared and no way back', async () => {
    renderSolver(mockApi());
    await screen.findByRole('textbox');

    await handIn('Han har jobbet der i tre år.');
    await userEvent.click(await screen.findByRole('button', { name: /next question/i }));

    expect(screen.getByRole('heading', { name: /Hva vil Bartek gjerne ha/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('closes the attempt with every answer at once, and reports a routed set as unjudged', async () => {
    const onChecked = vi.fn();
    const fetchMock = mockApi();
    renderSolver(fetchMock, onChecked);
    await screen.findByRole('textbox');

    await handIn('Han har jobbet der i tre år.');
    await userEvent.click(await screen.findByRole('button', { name: /next question/i }));
    await handIn('Mer ansvar.');
    await userEvent.click(await screen.findByRole('button', { name: /finish/i }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(null));

    const submit = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
    expect(JSON.parse(String(submit?.[1]?.body)).submittedAnswer).toEqual({
      answers: [
        { questionId: 'sa1', text: 'Han har jobbet der i tre år.' },
        { questionId: 'sa2', text: 'Mer ansvar.' },
      ],
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 passed · 1 partly · 0 not passed');
  });

  // Plan 51 §8 Q6: a reload continues the set instead of replaying it.
  it('resumes at the first unanswered question, carrying what is already in', async () => {
    const onChecked = vi.fn();
    const fetchMock = mockApi({
      answeredQuestions: [
        { questionId: 'sa1', text: 'Han har jobbet der i tre år.', verdict: 'pass' },
      ],
    });
    renderSolver(fetchMock, onChecked);

    // The first question is closed and is not offered again.
    expect(
      await screen.findByRole('heading', { name: /Hva vil Bartek gjerne ha/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();

    await handIn('Mer ansvar.');
    await userEvent.click(await screen.findByRole('button', { name: /finish/i }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(null));

    // The answer handed in before the reload is in the aggregate — leaving it out would
    // hand in a set missing the question the student already answered.
    const submit = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
    expect(JSON.parse(String(submit?.[1]?.body)).submittedAnswer).toEqual({
      answers: [
        { questionId: 'sa1', text: 'Han har jobbet der i tre år.' },
        { questionId: 'sa2', text: 'Mer ansvar.' },
      ],
    });
    // The tally counts the resumed verdict, not only the one earned in this sitting.
    expect(screen.getByRole('status')).toHaveTextContent('2 passed · 0 partly · 0 not passed');
  });

  it('closes a resumed set that has every answer in and was never handed in', async () => {
    const onChecked = vi.fn();
    const fetchMock = mockApi({
      answeredQuestions: [
        { questionId: 'sa1', text: 'Han har jobbet der i tre år.', verdict: 'pass' },
        { questionId: 'sa2', text: 'Mer ansvar.', verdict: 'partial' },
      ],
    });
    renderSolver(fetchMock, onChecked);

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(null));
    // Closed once, not once per render.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/submit'))).toHaveLength(1);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '1 passed · 1 partly · 0 not passed',
    );
  });

  it('ignores a resumed answer to a question the set no longer holds', async () => {
    const fetchMock = mockApi({
      answeredQuestions: [{ questionId: 'gone', text: 'noe', verdict: 'pass' }],
    });
    renderSolver(fetchMock);

    // The set starts from the top rather than from a question that cannot be found.
    expect(
      await screen.findByRole('heading', { name: /Hvor lenge har Bartek jobbet/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('refuses to run at all when the set arrives with its answer key attached', async () => {
    renderSolver(
      mockApi({
        content: {
          ...PROJECTION,
          questions: [
            {
              ...PROJECTION.questions[0],
              elements: [{ id: 'e1', label: 'Tre år', anchors: ['tre år'], required: true }],
            },
          ],
        },
      }),
    );

    // An engine older than plan 51 phase 2. Stripping the key here would hide that it
    // was ever sent; the runner refuses and the deployment stays visible.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('offers a retry when the attempt cannot be opened', async () => {
    renderSolver(mockApi({ startFails: true }));

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('tells a refused hand-in from a failed one', async () => {
    renderSolver(mockApi({ answerStatus: 422 }));
    await screen.findByRole('textbox');

    await handIn('Han har jobbet der i tre år.');

    expect(await screen.findByText(/already been handed in/i)).toBeInTheDocument();
    // Still on the question, and still able to try — nothing was recorded.
    expect(screen.getByRole('button', { name: /hand in answer/i })).toBeInTheDocument();
  });

  it('says the set could not be confirmed when the close is lost', async () => {
    const onChecked = vi.fn();
    renderSolver(mockApi({ submitFails: true }), onChecked);
    await screen.findByRole('textbox');

    await handIn('Han har jobbet der i tre år.');
    await userEvent.click(await screen.findByRole('button', { name: /next question/i }));
    await handIn('Mer ansvar.');
    await userEvent.click(await screen.findByRole('button', { name: /finish/i }));

    expect(await screen.findByText(/could not confirm/i)).toBeInTheDocument();
    expect(onChecked).not.toHaveBeenCalled();
  });

  it('accepts a lost response when the engine says the set is already in', async () => {
    const onChecked = vi.fn();
    renderSolver(
      mockApi({ submitFails: true, attemptStatus: { status: 'ROUTED_FOR_REVIEW' } }),
      onChecked,
    );
    await screen.findByRole('textbox');

    await handIn('Han har jobbet der i tre år.');
    await userEvent.click(await screen.findByRole('button', { name: /next question/i }));
    await handIn('Mer ansvar.');
    await userEvent.click(await screen.findByRole('button', { name: /finish/i }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith(null));
    expect(screen.queryByText(/could not confirm/i)).not.toBeInTheDocument();
  });
});
