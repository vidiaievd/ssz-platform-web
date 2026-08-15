import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewQueueResponse } from '@/features/content-authoring/types/review';

import { ReviewQueue } from './review-queue';

/** The exercise as the authoring read returns it — the queue borrows its sentences. */
const EXERCISE = {
  id: 'ex-1',
  templateCode: 'translate_to_target',
  content: {
    dir: 'to_target',
    langs: { explain: 'Russisk', target: 'Norsk' },
    format: 'set',
    note: '',
    items: [
      { id: 'i1', dir: 'to_target', source: 'Я живу в Тромсё три года.', gloss: [] },
      { id: 'i2', dir: 'to_target', source: 'Я люблю кошек.', gloss: [] },
    ],
  },
  expectedAnswers: {
    items: {
      i1: { refs: ['Jeg har bodd i Tromsø i tre år.'], teacherNote: 'Watch the tense.' },
      i2: { refs: ['Jeg liker katter.'] },
    },
  },
};

const QUEUE: ReviewQueueResponse = {
  total: 1,
  limit: 20,
  offset: 0,
  items: [
    {
      attemptId: 'att-1',
      userId: 'learner-9abcdef0',
      exerciseId: 'ex-1',
      templateCode: 'translate_to_target',
      submittedAnswer: [],
      submittedAt: '2026-08-15T09:00:00.000Z',
      timeSpentSeconds: 90,
      selfChecksUsed: 1,
      answersRevealed: false,
      details: {
        totalItems: 2,
        routedItems: 1,
        passedItems: 1,
        items: [
          {
            itemId: 'i2',
            verdict: 'exact',
            similarity: 1,
            ref: 'Jeg liker katter.',
            submitted: 'Jeg liker katter.',
            tokens: [],
            missing: [],
            banned: [],
            routing: 'pass',
          },
          {
            itemId: 'i1',
            verdict: 'near',
            similarity: 0.82,
            ref: 'Jeg har bodd i Tromsø i tre år.',
            submitted: 'Jeg bor i Tromsø i tre år.',
            tokens: [
              { t: 'eq', w: 'Jeg', typo: null },
              { t: 'extra', w: 'bor', typo: null },
              { t: 'missing', w: 'har', typo: null },
            ],
            missing: [{ text: 'har bodd', note: 'The task trains the perfect tense.' }],
            banned: [],
            routing: 'teacher',
          },
        ],
      },
    },
  ],
};

const fetchMock = vi.fn();

function renderQueue(queue: ReviewQueueResponse = QUEUE, exercise: unknown = EXERCISE) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/review-queue')) {
      return Promise.resolve(new Response(JSON.stringify(queue), { status: 200 }));
    }
    if (url.includes('/answers')) {
      return Promise.resolve(new Response(JSON.stringify(exercise), { status: 200 }));
    }
    if ((init?.method ?? 'GET') === 'POST') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            attemptId: 'att-1',
            status: 'SCORED',
            score: 50,
            approvedItems: 1,
            totalItems: 2,
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReviewQueue exerciseId="ex-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup() };
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ReviewQueue', () => {
  it('says how much is waiting and which sentences the machine had already closed', async () => {
    renderQueue();

    expect(await screen.findByText('1 submission waiting')).toBeInTheDocument();
    expect(screen.getByText('1 closed automatically · 1 to read')).toBeInTheDocument();
    // The hit is there, collapsed to a line rather than opened for a decision.
    expect(screen.getByText('Jeg liker katter.')).toBeInTheDocument();
  });

  /**
   * The three levels of error analysis this template rests on: the diff the machine can
   * draw, the guard it can name, and the note only the teacher sees.
   */
  it('opens the sentence that needs a person, with its diff, key and notes', async () => {
    renderQueue();

    expect(await screen.findByText('Jeg bor i Tromsø i tre år.')).toBeInTheDocument();
    expect(screen.getByLabelText('The answer against the key, word by word')).toBeInTheDocument();
    expect(screen.getByText('Compared with: Jeg har bodd i Tromsø i tre år.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Missing what the task asks for: «har bodd» — The task trains the perfect tense.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Watch the tense.')).toBeInTheDocument();
  });

  it('sends the per-sentence decisions, not a mark', async () => {
    const { user } = renderQueue();
    await screen.findByText('Jeg bor i Tromsø i tre år.');

    await user.click(screen.getByRole('button', { name: /Counts/ }));
    await user.click(screen.getByRole('button', { name: /^Approve$/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/exercises/ex-1/attempts/att-1/review',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            outcome: 'approved',
            decisions: [{ itemId: 'i1', approved: true }],
          }),
        }),
      ),
    );
  });

  it('sends a submission back with the teacher’s comment and no decisions of its own', async () => {
    const { user } = renderQueue();
    await screen.findByText('Jeg bor i Tromsø i tre år.');

    await user.type(
      screen.getByLabelText('A word about the whole submission'),
      'Look at the tense.',
    );
    await user.click(screen.getByRole('button', { name: /Send back/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/exercises/ex-1/attempts/att-1/review',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            outcome: 'returned',
            decisions: [],
            comment: 'Look at the tense.',
          }),
        }),
      ),
    );
  });

  /** Nearly-right first: a typo is a second's work, an `off` is a reading. */
  it('puts the nearly-right sentences first', async () => {
    renderQueue({
      ...QUEUE,
      items: [
        {
          ...QUEUE.items[0]!,
          details: {
            totalItems: 2,
            routedItems: 2,
            passedItems: 0,
            items: [
              {
                ...QUEUE.items[0]!.details!.items[1]!,
                itemId: 'i2',
                verdict: 'off',
                submitted: 'Helt annet.',
              },
              {
                ...QUEUE.items[0]!.details!.items[1]!,
                itemId: 'i1',
                verdict: 'typo',
                submitted: 'Jeg har bodd i Tromso i tre år.',
              },
            ],
          },
        },
      ],
    });

    const items = await screen.findAllByText(/^(Helt annet\.|Jeg har bodd i Tromso i tre år\.)$/);
    expect(items[0]).toHaveTextContent('Jeg har bodd i Tromso i tre år.');
  });

  it('says plainly when there is nothing to mark', async () => {
    renderQueue({ items: [], total: 0, limit: 20, offset: 0 });

    expect(
      await screen.findByText(
        'Nothing waiting — every submission on this exercise has been dealt with.',
      ),
    ).toBeInTheDocument();
  });
});

/**
 * The same queue, the other template. `error_correction` reaches this screen through the
 * same route for the same reason — its check may only ever approve — so what is asserted
 * here is that the screen reads *its* details rather than translate's: mistakes one by
 * one instead of a diff, and a sentence the check closed credited without a teacher.
 */
describe('ReviewQueue — error_correction', () => {
  const EC_EXERCISE = {
    id: 'ex-2',
    templateCode: 'error_correction',
    content: {
      mode: 'sentences',
      items: [
        { id: 'i1', wrong: 'I går jeg gikk på kino.' },
        { id: 'i2', wrong: 'Hun har bodde i Bergen.' },
      ],
    },
    expectedAnswers: {
      items: {
        i1: { ref: 'I går gikk jeg på kino.', teacherNote: 'Ask about V2 next time.' },
        i2: { ref: 'Hun har bodd i Bergen.' },
      },
    },
  };

  const EC_QUEUE: ReviewQueueResponse = {
    total: 1,
    limit: 20,
    offset: 0,
    items: [
      {
        attemptId: 'att-2',
        userId: 'learner-12345678',
        exerciseId: 'ex-2',
        templateCode: 'error_correction',
        submittedAnswer: {},
        submittedAt: '2026-08-15T09:00:00.000Z',
        timeSpentSeconds: 120,
        selfChecksUsed: 0,
        answersRevealed: false,
        details: {
          totalItems: 2,
          routedItems: 1,
          passedItems: 1,
          items: [
            {
              itemId: 'i2',
              verdict: 'exact',
              similarity: 1,
              routing: 'pass',
              built: 'Hun har bodd i Bergen.',
              fixedSpans: 1,
              totalSpans: 1,
              spans: [],
              stray: [],
              edits: null,
            },
            {
              itemId: 'i1',
              verdict: 'partial',
              similarity: 0.78,
              routing: 'teacher',
              built: 'I går gikk jeg på kinoen.',
              fixedSpans: 1,
              totalSpans: 2,
              spans: [
                {
                  key: 's1',
                  type: 'order',
                  state: 'fixed',
                  wrong: 'jeg gikk',
                  fix: 'gikk jeg',
                  submitted: 'gikk jeg',
                  note: 'The verb comes second.',
                },
                {
                  key: 's2',
                  type: 'form',
                  state: 'missed',
                  wrong: 'kino.',
                  fix: 'kino.',
                  submitted: '',
                  note: '',
                },
              ],
              stray: [{ kind: 'edit', index: 4, word: 'kinoen.' }],
              edits: null,
            },
          ],
        },
      },
    ],
  };

  it('collapses the sentence its own check closed, and opens only the other one', async () => {
    renderQueue(EC_QUEUE, EC_EXERCISE);

    expect(await screen.findByText('1 submission waiting')).toBeInTheDocument();
    expect(screen.getByText('1 closed automatically · 1 to read')).toBeInTheDocument();
    // Collapsed: the sentence the learner's edits produced, with no decision attached.
    expect(screen.getByText('Hun har bodd i Bergen.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Counts' })).toHaveLength(1);
  });

  it('shows the mistakes one by one rather than a diff', async () => {
    renderQueue(EC_QUEUE, EC_EXERCISE);

    // The faulty sentence the learner was given, and what their edits produced.
    expect(await screen.findByText('I går jeg gikk på kino.')).toBeInTheDocument();
    expect(screen.getByText('I går gikk jeg på kinoen.')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 mistakes corrected')).toBeInTheDocument();

    // Each planted mistake, what the learner put there, and the author's own note.
    expect(screen.getByText('They wrote: gikk jeg')).toBeInTheDocument();
    expect(screen.getByText('Left as it was.')).toBeInTheDocument();
    expect(screen.getByText('The verb comes second.')).toBeInTheDocument();

    // Changed where nothing was wrong, and the note only the teacher sees.
    expect(
      screen.getByText('Also changed where there was no mistake: «kinoen.»'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ask about V2 next time.')).toBeInTheDocument();
    // Its own vocabulary, not translate's.
    expect(screen.getByText('Partly corrected')).toBeInTheDocument();
  });
});
