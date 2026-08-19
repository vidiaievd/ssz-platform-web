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

/**
 * A self-check as the engine answers one: a verdict, a diff whose key words are already
 * masked, and the rules of the task the answer misses. No accepted translation anywhere.
 */
const SELF_CHECK = {
  attemptId: 'att-1',
  templateCode: 'translate_to_target',
  checksUsed: 1,
  checksLeft: 1,
  passing: 0,
  items: [
    {
      itemId: 'i1',
      verdict: 'near',
      sim: 0.8,
      tokens: [
        { t: 'eq', w: 'Jeg', typo: null },
        { t: 'extra', w: 'bor', typo: null },
        { t: 'missing', w: '•••', typo: null },
        { t: 'eq', w: 'Tromsø', typo: null },
      ],
      missing: [{ text: 'har bodd', note: 'The exercise practises the perfect tense.' }],
      banned: [{ text: 'bor' }],
    },
  ],
};

function mockApi(
  responses: {
    submit?: unknown;
    submitFails?: boolean;
    startFails?: boolean;
    last?: unknown;
    started?: unknown;
    selfCheck?: unknown;
    selfCheckStatus?: number;
    /** What `GET .../attempts/:attemptId` answers when a failed `submit` checks in (47.0.B). */
    attemptStatus?: unknown;
    attemptStatusFails?: boolean;
  } = {},
) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);

    if (path.endsWith('/self-check')) {
      const status = responses.selfCheckStatus ?? 200;
      return new Response(
        JSON.stringify(status === 200 ? (responses.selfCheck ?? SELF_CHECK) : { error: 'spent' }),
        { status, headers: { 'content-type': 'application/json' } },
      );
    }

    if (init?.method === undefined) {
      // `GET .../attempts/<attemptId>` (47.0.B's status check) vs.
      // `GET .../attempts` (the last-finished-attempt lookup) — same verb, different path.
      if (/\/attempts\/[^/]+$/.test(path)) {
        if (responses.attemptStatusFails) {
          return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
        }
        return new Response(
          JSON.stringify(responses.attemptStatus ?? { status: 'IN_PROGRESS' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(responses.last ?? { attempt: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (responses.startFails && !path.endsWith('/submit')) {
      return new Response(JSON.stringify({ error: 'nope' }), { status: 502 });
    }
    if (path.endsWith('/submit') && responses.submitFails) {
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

  it('asks the server how the translation is going, and sends the draft to ask', async () => {
    const fetchMock = mockApi();
    renderSolver(fetchMock);

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Check my answers (2 left)' }));

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/self-check'));
    expect(call).toBeDefined();
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
      draftAnswer: { answers: [{ itemId: 'i1', text: 'Jeg bor i Tromsø i tre år.' }] },
    });

    expect(await screen.findByText('Close — something differs from the key.')).toBeInTheDocument();
    // The rules of the task, with the author's reason — and the key's own word masked.
    expect(
      screen.getByText('The task asks for «har bodd» — The exercise practises the perfect tense.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Avoid «bor» here.')).toBeInTheDocument();
    expect(screen.getByText('•••')).toBeInTheDocument();
    expect(
      screen.getByText('0 of 1 sentences would be approved as they stand'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my answers (1 left)' })).toBeEnabled();
  });

  it('drops the self-check the moment the translation changes under it', async () => {
    renderSolver(mockApi());

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Check my answers (2 left)' }));
    expect(await screen.findByText('Close — something differs from the key.')).toBeInTheDocument();

    await answer(' Nei.');

    expect(screen.queryByText('Close — something differs from the key.')).not.toBeInTheDocument();
  });

  it('puts the button away when the engine says the budget is spent', async () => {
    renderSolver(mockApi({ selfCheckStatus: 422 }));

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Check my answers (2 left)' }));

    expect(await screen.findByRole('button', { name: 'No checks left' })).toBeDisabled();
    expect(screen.queryByText('Could not check that — try again')).not.toBeInTheDocument();
  });

  it('offers nothing to check before a single sentence is written', async () => {
    renderSolver(mockApi());

    expect(await screen.findByRole('button', { name: 'Check my answers (2 left)' })).toBeDisabled();
  });

  it('takes the self-check off the screen once the work is with the teacher', async () => {
    renderSolver(mockApi({ submit: ROUTED }));

    await answer('Jeg bor i Tromsø i tre år.');
    await userEvent.click(screen.getByRole('button', { name: 'Check my answers (2 left)' }));
    expect(await screen.findByText('Close — something differs from the key.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    await screen.findByText('Handed in. Your teacher will look at it.');
    expect(screen.queryByText('Close — something differs from the key.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check my answers/ })).not.toBeInTheDocument();
  });

  it('puts a previous submission back, and says it was handed in', async () => {
    renderSolver(mockApi({ last: LAST_ATTEMPT }));

    expect(await screen.findByText('Handed in. Your teacher will look at it.')).toBeInTheDocument();
    expect(await screen.findByRole('textbox')).toHaveValue('Jeg bor i Tromsø i tre år.');
  });

  /**
   * The verdict phase. For this template it is the only place an answer is ever called
   * wrong — the machine may not say it, so the words on screen are the teacher's or there
   * are none.
   */
  it("shows the teacher's verdict once one has read the submission", async () => {
    renderSolver(
      mockApi({
        last: {
          attempt: {
            ...LAST_ATTEMPT.attempt,
            status: 'SCORED',
            score: 50,
            reviewedAt: '2026-08-14T12:00:00.000Z',
            reviewComment: 'Bra jobbet, men se på perfektum.',
            reviewDecisions: [{ itemId: 'i1', approved: false, comment: '«bor» er presens.' }],
          },
        },
      }),
    );

    expect(await screen.findByText('Your teacher has marked this')).toBeInTheDocument();
    expect(screen.getByText('50 out of 100 for this attempt.')).toBeInTheDocument();
    expect(screen.getByText('Bra jobbet, men se på perfektum.')).toBeInTheDocument();
    // The teacher's word about one sentence sits with that sentence.
    expect(screen.getByText('not counted')).toBeInTheDocument();
    expect(screen.getByText('«bor» er presens.')).toBeInTheDocument();
  });

  it('says a sentence was not counted without inventing a reason for it', async () => {
    renderSolver(
      mockApi({
        last: {
          attempt: {
            ...LAST_ATTEMPT.attempt,
            status: 'SCORED',
            score: 0,
            reviewedAt: '2026-08-14T12:00:00.000Z',
            reviewComment: null,
            reviewDecisions: [{ itemId: 'i1', approved: false }],
          },
        },
      }),
    );

    expect(await screen.findByText('Your teacher did not count this one.')).toBeInTheDocument();
  });

  it('says when the work was sent back rather than marked', async () => {
    renderSolver(
      mockApi({
        last: {
          attempt: {
            ...LAST_ATTEMPT.attempt,
            status: 'RETURNED',
            reviewedAt: '2026-08-14T12:00:00.000Z',
            reviewComment: 'Prøv igjen med perfektum.',
            reviewDecisions: [],
          },
        },
      }),
    );

    expect(await screen.findByText('Your teacher sent this back')).toBeInTheDocument();
    expect(screen.getByText('Prøv igjen med perfektum.')).toBeInTheDocument();
    expect(screen.queryByText(/out of 100/)).not.toBeInTheDocument();
  });

  /**
   * 47.0.B: a failed `submit` is not a verdict on its own — the work may already have
   * reached the teacher, only the response got lost on the way back.
   */
  describe('when submit fails', () => {
    it('shows "handed in" — not an error — when the attempt already reached the teacher', async () => {
      renderSolver(
        mockApi({ submitFails: true, attemptStatus: { status: 'ROUTED_FOR_REVIEW' } }),
      );

      await answer('Jeg har bodd i Tromsø i tre år.');
      await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

      expect(
        await screen.findByText('Handed in. Your teacher will look at it.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
    });

    it('offers a resend, and says the last attempt did not go through, when nothing arrived', async () => {
      renderSolver(mockApi({ submitFails: true, attemptStatus: { status: 'IN_PROGRESS' } }));

      await answer('Jeg har bodd i Tromsø i tre år.');
      await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

      expect(
        await screen.findByText(
          "That attempt didn't go through — your answer is still here, try again.",
        ),
      ).toBeInTheDocument();
      expect(await screen.findByRole('textbox')).toHaveValue('Jeg har bodd i Tromsø i tre år.');
      expect(screen.getByRole('button', { name: 'Hand in to the teacher' })).toBeEnabled();
    });

    it('says it could not confirm delivery, not that the work was lost, when the check itself fails', async () => {
      renderSolver(mockApi({ submitFails: true, attemptStatusFails: true }));

      await answer('Jeg har bodd i Tromsø i tre år.');
      await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

      expect(
        await screen.findByText("Couldn't confirm that reached your teacher — try again."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/didn't go through/i)).not.toBeInTheDocument();
    });
  });
});
