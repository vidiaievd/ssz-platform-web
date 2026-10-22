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
