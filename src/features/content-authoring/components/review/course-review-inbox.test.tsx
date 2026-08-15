import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  CourseReviewQueueResponse,
  ReviewQueueEntry,
} from '@/features/content-authoring/types/review';

// The locale-aware Link pulls in next-intl's client navigation, which needs a router.
// The group's link is still asserted — as the plain anchor it renders to.
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CourseReviewInbox } = await import('./course-review-inbox');

/** Two exercises of the same course, so the screen has something to group. */
const EXERCISES = [
  {
    exerciseId: 'ex-1',
    itemId: 'row-1',
    title: 'Oversett setningene',
    levelTitle: 'B1',
    moduleTitle: 'Leksjon 3',
    sectionTitle: 'Tekst A',
  },
  {
    exerciseId: 'ex-2',
    itemId: 'row-2',
    title: 'Rett feilene',
    levelTitle: 'B1',
    moduleTitle: 'Leksjon 4',
    sectionTitle: null,
  },
];

const DETAILS = {
  totalItems: 1,
  routedItems: 1,
  passedItems: 0,
  items: [
    {
      itemId: 'i1',
      verdict: 'near' as const,
      similarity: 0.82,
      ref: 'Jeg har bodd i Tromsø i tre år.',
      submitted: 'Jeg bor i Tromsø i tre år.',
      tokens: [],
      missing: [],
      banned: [],
      routing: 'teacher' as const,
    },
  ],
};

function entry(overrides: Partial<ReviewQueueEntry>): ReviewQueueEntry {
  return {
    attemptId: 'att-1',
    userId: 'user-1',
    exerciseId: 'ex-1',
    templateCode: 'translate_to_target',
    submittedAnswer: [],
    submittedAt: '2026-08-15T09:00:00.000Z',
    timeSpentSeconds: 90,
    selfChecksUsed: 0,
    answersRevealed: false,
    details: DETAILS,
    ...overrides,
  };
}

const QUEUE: CourseReviewQueueResponse = {
  total: 3,
  limit: 20,
  offset: 0,
  exercises: EXERCISES,
  learners: {
    'user-1': { userId: 'user-1', displayName: 'Kari Nordmann' },
    'user-2': { userId: 'user-2', displayName: 'Ola Hansen' },
  },
  items: [
    entry({ attemptId: 'att-1', userId: 'user-1' }),
    entry({ attemptId: 'att-2', userId: 'user-2' }),
    entry({ attemptId: 'att-3', userId: 'user-1', exerciseId: 'ex-2' }),
  ],
};

const EXERCISE_DOCUMENT = {
  id: 'ex-1',
  templateCode: 'translate_to_target',
  content: {
    dir: 'to_target',
    langs: { explain: 'Russisk', target: 'Norsk' },
    format: 'set',
    note: '',
    items: [{ id: 'i1', dir: 'to_target', source: 'Я живу в Тромсё три года.', gloss: [] }],
  },
  expectedAnswers: {
    items: { i1: { refs: ['Jeg har bodd i Tromsø i tre år.'] } },
  },
};

const fetchMock = vi.fn();

function renderInbox(queue: CourseReviewQueueResponse = QUEUE) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/review-queue')) {
      return Promise.resolve(new Response(JSON.stringify(queue), { status: 200 }));
    }
    if (url.includes('/answers')) {
      return Promise.resolve(new Response(JSON.stringify(EXERCISE_DOCUMENT), { status: 200 }));
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CourseReviewInbox containerId="course-1" schoolSlug="oslo-skole" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CourseReviewInbox', () => {
  it('gathers the course into one heading per exercise', async () => {
    renderInbox();

    expect(await screen.findByText('3 submissions waiting')).toBeInTheDocument();
    // Marking is done in sittings: the same key and the same judgement carry across a
    // group, and interleaving exercises means re-reading the assignment every card.
    const first = await screen.findByRole('heading', { name: 'Oversett setningene' });
    expect(first).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rett feilene' })).toBeInTheDocument();
    // Where in the course it sits, so the teacher knows what was being asked.
    expect(screen.getByText('Leksjon 3')).toBeInTheDocument();
    expect(screen.getByText('Tekst A')).toBeInTheDocument();
  });

  it('names the learners rather than printing their ids', async () => {
    renderInbox();

    // Kari handed in both exercises, so she is named on both of her cards.
    expect(await screen.findAllByText('Kari Nordmann')).toHaveLength(2);
    expect(screen.getByText('Ola Hansen')).toBeInTheDocument();
    expect(screen.queryByText(/^Learner /)).not.toBeInTheDocument();
  });

  it('offers each group its own single-exercise queue', async () => {
    renderInbox();

    const links = await screen.findAllByRole('link', { name: 'Marking queue' });
    expect(links[0]).toHaveAttribute(
      'href',
      '/school/oslo-skole/content/course-1/lessons/row-1/review',
    );
  });

  it('skips exercises nobody has handed in', async () => {
    renderInbox({ ...QUEUE, total: 1, items: [entry({})] });

    expect(await screen.findByRole('heading', { name: 'Oversett setningene' })).toBeInTheDocument();
    // The course places it; the queue has nothing from it, so it is not on the screen.
    expect(screen.queryByRole('heading', { name: 'Rett feilene' })).not.toBeInTheDocument();
  });

  it('says plainly when the whole course is marked', async () => {
    renderInbox({ ...QUEUE, total: 0, items: [] });

    expect(
      await screen.findByText(
        'Nothing waiting — every submission in this course has been dealt with.',
      ),
    ).toBeInTheDocument();
  });
});
