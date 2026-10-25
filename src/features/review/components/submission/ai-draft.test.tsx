import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';
import type { ReviewSubmission } from '@/features/review/types';
import type { TranslateItemDetail } from '@/features/content-authoring/types/review';
import { useReviewDraftsStore } from '@/features/review/stores/review-drafts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/en/w/ws-1/review/att-1',
}));

const { SubmissionPanel } = await import('./submission-panel');

const SENTENCE: TranslateItemDetail = {
  itemId: 'i1',
  routing: 'teacher',
  verdict: 'near',
  ref: 'I går var jeg på jobb.',
  submitted: 'I går jeg var på jobb.',
  tokens: [],
  missing: [],
  banned: [],
  prompt: 'Yesterday I was at work.',
};

const BASE: ReviewSubmission = {
  id: 'att-1',
  status: 'pending',
  student: { id: 's1', name: 'Anna Kowalska', groupName: 'A2 kveld' },
  exercise: {
    id: 'ex-1',
    title: 'Oversett',
    type: 'translate_to_target',
    path: { course: 'Ny i Norge A2', lesson: 'Leksjon 7' },
    available: true,
    contentLang: 'nb',
  },
  submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
  ageHours: 1,
  slaHours: 24,
  overdue: false,
  attemptNo: 1,
  previous: null,
  decision: null,
  lock: null,
  details: { totalItems: 1, routedItems: 1, passedItems: 0, items: [SENTENCE] },
  text: null,
  rubric: null,
  rubricMarks: null,
  reviewDecisions: null,
  playback: null,
  aiDraft: {
    status: 'ready',
    items: [
      {
        itemId: 'i1',
        sentenceIndex: 1,
        aspect: 'order',
        fragment: 'jeg var',
        comment: 'V2: verbet står på andre plass.',
        suggestion: 'var jeg',
      },
    ],
    summary: 'Ordstilling etter adverbial.',
    modelId: 'fake-model',
    promptVersion: 'review_draft@1',
    createdAt: new Date().toISOString(),
  },
  submittedAnswer: {},
  aiVerdict: null,
  autoAcceptAt: null,
  acceptedAtTerm: false,
  canDecide: true,
};

const WITH_KEY: Entitlements = {
  account: { type: 'workspace', externalId: 'ws-1' },
  features: { 'ai.review_draft': { enabled: true, monthlyCredits: '50', limits: {} } },
  validUntil: new Date(Date.now() + 86_400_000).toISOString(),
  version: 1,
};

function upstream(submission: Partial<ReviewSubmission>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/lock')
        ? new Response(JSON.stringify({ lock: null, mine: init?.method === 'POST' }), {
            status: 200,
          })
        : new Response(JSON.stringify({ ...BASE, ...submission }), { status: 200 }),
    ),
  );
}

function renderPanel(entitlements: Entitlements | null = WITH_KEY) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EntitlementsProvider entitlements={entitlements}>
          <SubmissionPanel school="oslo-skole" id="att-1" />
        </EntitlementsProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const decisionBody = () => {
  const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes('/decision'));
  return call === undefined ? {} : (JSON.parse(String(call[1]?.body)) as Record<string, unknown>);
};
const outcomes = () => useReviewDraftsStore.getState().drafts['att-1']?.ai ?? {};
const sentenceComment = () => useReviewDraftsStore.getState().drafts['att-1']?.sentences.i1;

beforeEach(() => {
  localStorage.clear();
  useReviewDraftsStore.setState({ drafts: {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('AI draft on the review card', () => {
  it('shows the remark under its sentence, labelled as the model’s', async () => {
    upstream({});
    renderPanel();

    expect(await screen.findByText('V2: verbet står på andre plass.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'AI draft' })).toBeInTheDocument();
    expect(screen.getByText('Ordstilling etter adverbial.')).toBeInTheDocument();
  });

  // Plan 79, step 1.7: error_correction's "differs from the key, and right".
  it('names an alternative repair as such rather than as an error', async () => {
    upstream({
      aiDraft: {
        ...BASE.aiDraft!,
        items: [
          {
            itemId: 'i1',
            sentenceIndex: 1,
            aspect: 'alternative',
            fragment: 'jeg var',
            comment: 'Også riktig her.',
            suggestion: null,
          },
        ],
      },
    });
    renderPanel();

    expect(await screen.findByText('Også riktig her.')).toBeInTheDocument();
    expect(screen.getByText('also correct')).toBeInTheDocument();
  });

  it('takes a remark into the sentence comment as written', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Add to comment' }));

    expect(sentenceComment()).toBe('«jeg var» → «var jeg» — V2: verbet står på andre plass.');
    expect(outcomes()).toEqual({ '0': 'accepted' });
    expect(screen.getByText('added to comment')).toBeInTheDocument();
  });

  it('counts a remark as edited only once the reworded comment is saved', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Comment on this sentence' });
    expect(box).toHaveValue('«jeg var» → «var jeg» — V2: verbet står på andre plass.');
    expect(outcomes()).toEqual({});

    fireEvent.change(box, { target: { value: 'Husk V2: «I går var jeg».' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(sentenceComment()).toBe('Husk V2: «I går var jeg».');
    expect(outcomes()).toEqual({ '0': 'edited' });
  });

  it('leaves the remark waiting when the rewording is cancelled', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(outcomes()).toEqual({});
    expect(screen.getByRole('button', { name: 'Add to comment' })).toBeInTheDocument();
  });

  it('drops one remark, and brings it back', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(outcomes()).toEqual({ '0': 'discarded' });

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(outcomes()).toEqual({});
  });

  it('puts the whole draft aside', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Discard draft' }));

    expect(screen.queryByText('V2: verbet står på andre plass.')).not.toBeInTheDocument();
    expect(screen.getByText('AI draft discarded.')).toBeInTheDocument();
    expect(outcomes()).toEqual({ draft: 'discarded' });
  });

  it('adds the overall note to the comment on the whole work', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Add to overall comment' }));

    expect(useReviewDraftsStore.getState().drafts['att-1']?.comment).toBe(
      'Ordstilling etter adverbial.',
    );
  });

  it('sends what was done with the draft along with the verdict', async () => {
    upstream({});
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: /^Pass$/ }));

    await vi.waitFor(() =>
      expect(decisionBody()).toMatchObject({ aiOutcomes: { '0': 'discarded' } }),
    );
  });

  it('sends an empty record for a draft left alone, and none without the key', async () => {
    upstream({});
    const { unmount } = renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /^Pass$/ }));
    await vi.waitFor(() => expect(decisionBody()).toMatchObject({ aiOutcomes: {} }));
    unmount();

    upstream({});
    renderPanel(null);
    fireEvent.click(await screen.findByRole('button', { name: /^Pass$/ }));
    await vi.waitFor(() => expect(decisionBody()).toHaveProperty('verdict', 'approved'));
    expect(decisionBody()).not.toHaveProperty('aiOutcomes');
  });

  it('is the card as it was without the school’s key', async () => {
    upstream({});
    renderPanel(null);

    expect(await screen.findByText('I går jeg var på jobb.')).toBeInTheDocument();
    expect(screen.queryByText('V2: verbet står på andre plass.')).not.toBeInTheDocument();
  });

  it('draws a review the learner has already read without the draft key, and says so', async () => {
    upstream({ aiDraft: { ...BASE.aiDraft!, shownToLearner: true } });
    renderPanel(null);

    expect(await screen.findByText('V2: verbet står på andre plass.')).toBeInTheDocument();
    expect(screen.getByText(/The student has already seen this review/)).toBeInTheDocument();
    expect(screen.queryByText(/sees only what you take/)).not.toBeInTheDocument();
  });

  it('is the card as it was once a verdict stands', async () => {
    upstream({
      decision: {
        attemptId: 'att-1',
        outcome: 'approved',
        at: new Date().toISOString(),
        reviewerId: 't9',
        reviewerName: 'Marius Berg',
        comment: null,
      },
    });
    renderPanel();

    expect(await screen.findByText('Marius Berg has just reviewed this')).toBeInTheDocument();
    expect(screen.queryByText('V2: verbet står på andre plass.')).not.toBeInTheDocument();
  });
});

// Plan 79, step 1.7b: an essay is one text, marked as a whole.
describe('AI draft on an essay', () => {
  const ESSAY: Partial<ReviewSubmission> = {
    exercise: { ...BASE.exercise, type: 'writing_task', title: 'Skriv et brev' },
    details: null,
    text: 'Hei Kari!\n\nJeg flytte til Bergen i mai.',
    aiDraft: {
      ...BASE.aiDraft!,
      items: [
        {
          itemId: 'text',
          sentenceIndex: 1,
          aspect: 'grammar',
          fragment: 'Jeg flytte',
          comment: 'Presens: flytter.',
          suggestion: 'Jeg flytter',
        },
        {
          itemId: 'text',
          sentenceIndex: 1,
          aspect: 'task',
          fragment: null,
          comment: 'Du skriver ikke hvorfor du flytter.',
          suggestion: null,
        },
      ],
      summary: null,
    },
  };
  const overall = () => useReviewDraftsStore.getState().drafts['att-1']?.comment;

  it('shows every remark under the text, a whole-text one without a quotation', async () => {
    upstream(ESSAY);
    renderPanel();

    expect(await screen.findByText('Presens: flytter.')).toBeInTheDocument();
    expect(screen.getByText('Du skriver ikke hvorfor du flytter.')).toBeInTheDocument();
    expect(screen.getByText('about the whole text')).toBeInTheDocument();
    expect(screen.getByText('task')).toBeInTheDocument();
    expect(screen.getByText('Jeg flytte')).toBeInTheDocument();
  });

  it('takes remarks into the comment on the whole work, a whole-text one as its comment alone', async () => {
    upstream(ESSAY);
    renderPanel();

    const [quoted, whole] = await screen.findAllByRole('button', { name: 'Add to comment' });
    fireEvent.click(quoted!);
    fireEvent.click(whole!);

    expect(overall()).toBe(
      '«Jeg flytte» → «Jeg flytter» — Presens: flytter.\nDu skriver ikke hvorfor du flytter.',
    );
    expect(outcomes()).toEqual({ '0': 'accepted', '1': 'accepted' });
  });

  it('rewords a remark in a form of its own and adds it only when saved', async () => {
    upstream(ESSAY);
    renderPanel();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Add to comment' }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Goes into the overall comment' });
    // The remark alone: the comment already written is not the form's to edit.
    expect(box).toHaveValue('Du skriver ikke hvorfor du flytter.');

    fireEvent.change(box, { target: { value: 'Skriv også hvorfor.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(overall()).toBe('«Jeg flytte» → «Jeg flytter» — Presens: flytter.\nSkriv også hvorfor.');
    expect(outcomes()).toEqual({ '0': 'accepted', '1': 'edited' });
  });

  it('leaves the remark waiting when the rewording is cancelled', async () => {
    upstream(ESSAY);
    renderPanel();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(outcomes()).toEqual({});
    expect(overall() ?? '').toBe('');
    expect(screen.getAllByRole('button', { name: 'Add to comment' })).toHaveLength(2);
  });
});

// Plan 79, step 1.7e: a set of open questions — remarks hang under the answer they are about.
describe('AI draft on a short_answer set', () => {
  const QUESTION = {
    itemId: 'i1',
    routing: 'teacher',
    prompt: 'Hvorfor flyttet Ali til Bergen?',
    verdict: 'partial',
    submitted: 'Han flyttet fordi kona fikk jobb.',
    skipped: false,
    covered: 1,
    total: 2,
    tooShort: false,
    words: 6,
    elements: [
      { id: 'e1', label: 'Kona fikk jobb', required: true, hit: false, anchor: null },
      { id: 'e2', label: 'I Bergen', required: true, hit: false, anchor: null },
    ],
    model: 'Fordi kona hans fikk jobb i Bergen.',
  };
  const SET: Partial<ReviewSubmission> = {
    exercise: { ...BASE.exercise, type: 'short_answer', title: 'Teksten' },
    details: {
      totalItems: 1,
      routedItems: 1,
      passedItems: 0,
      coveredElements: 1,
      totalElements: 2,
      items: [QUESTION],
    } as unknown as ReviewSubmission['details'],
    aiDraft: {
      ...BASE.aiDraft!,
      items: [
        {
          itemId: 'i1',
          sentenceIndex: 1,
          aspect: 'content',
          fragment: null,
          comment: 'Du sier ikke at han flyttet til Bergen.',
          suggestion: null,
        },
      ],
      summary: null,
    },
  };

  it('shows a missing key point under its question, about the whole answer', async () => {
    upstream(SET);
    renderPanel();

    expect(await screen.findByText('Du sier ikke at han flyttet til Bergen.')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByText('about the whole answer')).toBeInTheDocument();
  });

  it('takes it into that question’s comment as its comment alone', async () => {
    upstream(SET);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Add to comment' }));

    expect(sentenceComment()).toBe('Du sier ikke at han flyttet til Bergen.');
    expect(outcomes()).toEqual({ '0': 'accepted' });
  });
});
