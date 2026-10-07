import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReadAloudDetails } from '@/features/content-authoring/types/review';
import type { ReviewSubmission } from '@/features/review/types';

import { useReviewDraftsStore } from '../../stores/review-drafts';
import { useReviewViewStore } from '../../stores/review-view-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/en/school/oslo-skole/review/att-1',
}));

const { SubmissionPanel } = await import('./submission-panel');

const DETAILS: ReadAloudDetails = {
  totalItems: 2,
  passedItems: 0,
  mode: 'read',
  revision: 'return',
  prompts: [
    {
      itemId: 'p1',
      label: 'Avsnitt 1',
      material: { kind: 'read', text: 'Jeg søker stillingen som sykepleier.' },
      note: 'Hør etter trykket i «sykepleier».',
      focus: [{ id: 'f1', word: 'sykepleier', note: 'Trykk på første stavelse' }],
      minSeconds: 15,
      maxSeconds: 60,
      recording: { assetId: 'asset-1', seconds: 21, takes: 2 },
    },
    {
      itemId: 'p2',
      label: 'Avsnitt 2',
      material: { kind: 'read', text: 'Jeg har jobbet i fem år.' },
      note: '',
      focus: [],
      minSeconds: 15,
      maxSeconds: 60,
      recording: { assetId: 'asset-2', seconds: 18, takes: 1 },
    },
  ],
};

const SUBMISSION: ReviewSubmission = {
  id: 'att-1',
  status: 'pending',
  student: { id: 's1', name: 'Anna Kowalska', groupName: 'A2 kveld' },
  exercise: {
    id: 'ex-1',
    title: 'Les høyt — jobbsøknad',
    type: 'read_aloud',
    path: { course: 'Norsk B1', lesson: 'Leksjon 3' },
    available: true,
    contentLang: 'nb',
  },
  submittedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  ageHours: 3,
  slaHours: 48,
  overdue: false,
  attemptNo: 1,
  previous: null,
  decision: null,
  lock: null,
  details: DETAILS,
  text: null,
  rubric: {
    passScore: 4,
    criteria: [
      {
        id: 'flow',
        name: 'Flyt',
        desc: 'Tempo og pauser.',
        weight: 1,
        levels: ['a', 'b', 'c', 'Jevn flyt'],
      },
      {
        id: 'sounds',
        name: 'Lyder',
        desc: 'Vokaler og trykk.',
        weight: 1,
        levels: ['a', 'b', 'c', 'd'],
      },
    ],
  },
  rubricMarks: null,
  reviewDecisions: null,
  playback: {
    'asset-1': {
      url: 'http://minio/rec-1.mp3?sig',
      mimeType: 'audio/mpeg',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      durationMs: 21_400,
      peaks: [0.2, 0.9, 0.4],
    },
    'asset-2': {
      url: 'http://minio/rec-2.mp3?sig',
      mimeType: 'audio/mpeg',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      durationMs: 18_000,
      peaks: null,
    },
  },
  submittedAnswer: {
    recordings: [
      { itemId: 'p1', assetId: 'asset-1', seconds: 21, takes: 2 },
      { itemId: 'p2', assetId: 'asset-2', seconds: 18, takes: 1 },
    ],
  },
  canDecide: true,
};

function upstream(
  submission: ReviewSubmission = SUBMISSION,
  decision: { status: number; body: unknown } = { status: 200, body: { nextId: null } },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/decision')) {
        return new Response(JSON.stringify(decision.body), { status: decision.status });
      }
      if (url.includes('/lock')) {
        return new Response(JSON.stringify({ lock: null, mine: init?.method === 'POST' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(submission), { status: 200 });
    }),
  );
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SubmissionPanel school="oslo-skole" id="att-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const block = (label: string) => screen.findByRole('article', { name: label });

/** Set both criteria of one prompt. */
async function markPrompt(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  flow: number,
  sounds: number,
) {
  const card = await block(label);
  const flowGroup = within(card).getByRole('group', { name: 'Mark for Flyt' });
  await user.click(within(flowGroup).getByRole('button', { name: String(flow) }));
  const soundsGroup = within(card).getByRole('group', { name: 'Mark for Lyder' });
  await user.click(within(soundsGroup).getByRole('button', { name: String(sounds) }));
}

async function commentOn(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  const card = await block(label);
  await user.type(within(card).getByLabelText(/Feedback to the student/), text);
}

const decisionBody = () => {
  const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes('/decision'));
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useReviewDraftsStore.setState({ drafts: {} });
  useReviewViewStore.setState({ arrivedAt: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('a read_aloud submission in the inbox (plan 70 §7.11)', () => {
  it('draws one block per prompt, each with its own player, rubric and comment (RA-Q1)', async () => {
    upstream();
    renderPanel();

    const first = await block('Avsnitt 1');
    expect(within(first).getByText('2 takes')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Play Submitted recording' })).toBeEnabled();
    expect(
      within(first).getByRole('slider', { name: 'Position in Submitted recording' }),
    ).toBeInTheDocument();
    expect(within(first).getByRole('group', { name: 'Mark for Flyt' })).toBeInTheDocument();
    expect(within(first).getByLabelText(/Feedback to the student/)).toBeInTheDocument();
    // The server-measured length, not the client's report.
    expect(within(first).getByText('0:21')).toBeInTheDocument();

    expect(await block('Avsnitt 2')).toBeInTheDocument();
    // A score per prompt, unset until the rubric is whole.
    expect(within(first).getByLabelText('Not marked, out of 6 points')).toHaveTextContent('—/6');
  });

  it('lights the focus words in the passage and shows the listening note (RA-Q2)', async () => {
    upstream();
    renderPanel();

    const first = await block('Avsnitt 1');
    const focus = within(first).getByText('sykepleier', { selector: 'mark' });
    expect(focus).toHaveAttribute('title', 'Trykk på første stavelse');
    expect(within(first).getByText('Listen for:')).toBeInTheDocument();
    expect(within(first).getByText('Hør etter trykket i «sykepleier».')).toBeInTheDocument();
    // No note, no line.
    expect(within(await block('Avsnitt 2')).queryByText('Listen for:')).not.toBeInTheDocument();
  });

  it('has no comment on the whole — the comments belong to the prompts', async () => {
    upstream();
    renderPanel();
    await block('Avsnitt 1');

    expect(screen.queryByLabelText('Comment on the whole submission')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('starts with every mark unset and decides nothing until the rubric is whole (RA-Q3)', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    const first = await block('Avsnitt 1');
    // An unmarked criterion is not a zero: no level is pressed, not even 0 (deviation 15).
    for (const name of ['Mark for Flyt', 'Mark for Lyder']) {
      const group = within(first).getByRole('group', { name });
      for (const level of within(group).getAllByRole('button')) {
        expect(level).toHaveAttribute('aria-pressed', 'false');
      }
    }
    await markPrompt(user, 'Avsnitt 1', 3, 3);
    expect(screen.getByRole('button', { name: /^Send back for a new recording/ })).toBeDisabled();
    expect(screen.getByText(/Mark every criterion before deciding/)).toBeInTheDocument();
  });

  it('will not send a verdict until every prompt has a comment (RA-Q4)', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    await markPrompt(user, 'Avsnitt 1', 3, 3);
    await markPrompt(user, 'Avsnitt 2', 2, 2);
    const action = screen.getByRole('button', { name: 'Approve (10/12)' });
    expect(action).toBeDisabled();
    expect(screen.getByText(/2 recordings have no comment/)).toBeInTheDocument();

    await commentOn(user, 'Avsnitt 1', 'Fin flyt.');
    expect(action).toBeDisabled();
    expect(screen.getByText(/1 recording has no comment/)).toBeInTheDocument();

    await commentOn(user, 'Avsnitt 2', 'Godt.');
    expect(action).toBeEnabled();
  });

  it('names the button by the verdict the marks come to and the revision policy (RA-Q5)', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    // Each prompt passes on its own: 6/6 and 2/6 (threshold 4) is a return, not an average.
    await markPrompt(user, 'Avsnitt 1', 3, 3);
    await markPrompt(user, 'Avsnitt 2', 1, 1);
    expect(
      screen.getByRole('button', { name: 'Send back for a new recording (8/12)' }),
    ).toBeInTheDocument();
    expect(within(await block('Avsnitt 1')).getByLabelText('6 of 6 points')).toBeInTheDocument();
  });

  it('closes as not passed when the exercise allows one submission', async () => {
    const user = userEvent.setup();
    upstream({ ...SUBMISSION, details: { ...DETAILS, revision: 'once' } });
    renderPanel();

    await markPrompt(user, 'Avsnitt 1', 0, 0);
    await markPrompt(user, 'Avsnitt 2', 0, 0);
    expect(screen.getByRole('button', { name: 'Close as not passed (0/12)' })).toBeInTheDocument();
  });

  it('sends marks keyed by prompt and criterion, and each comment against its prompt', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    await markPrompt(user, 'Avsnitt 1', 3, 2);
    await markPrompt(user, 'Avsnitt 2', 2, 3);
    await commentOn(user, 'Avsnitt 1', 'Fin flyt.');
    await commentOn(user, 'Avsnitt 2', 'Godt.');
    await user.click(screen.getByRole('button', { name: 'Approve (10/12)' }));

    await waitFor(() => expect(decisionBody()).toBeDefined());
    expect(decisionBody()).toMatchObject({
      verdict: 'approved',
      rubricMarks: { 'p1:flow': 3, 'p1:sounds': 2, 'p2:flow': 2, 'p2:sounds': 3 },
      sentenceComments: { p1: 'Fin flyt.', p2: 'Godt.' },
    });
    expect(decisionBody()).not.toHaveProperty('score');
  });

  it('says so when the server refuses a prompt without a comment', async () => {
    const user = userEvent.setup();
    upstream(SUBMISSION, {
      status: 422,
      body: { code: 'READ_ALOUD_COMMENT_REQUIRED', missing: ['p2'] },
    });
    renderPanel();

    await markPrompt(user, 'Avsnitt 1', 3, 3);
    await markPrompt(user, 'Avsnitt 2', 3, 3);
    await commentOn(user, 'Avsnitt 1', 'Fin.');
    await commentOn(user, 'Avsnitt 2', 'Fin.');
    await user.click(screen.getByRole('button', { name: 'Approve (12/12)' }));

    expect(
      await screen.findByText('Every recording needs a comment before the verdict can be sent.'),
    ).toBeInTheDocument();
  });

  it('says the recordings cannot be played when media-service did not answer', async () => {
    upstream({ ...SUBMISSION, playback: null });
    renderPanel();

    expect(
      await screen.findByText('The recordings cannot be played right now'),
    ).toBeInTheDocument();
    const first = await block('Avsnitt 1');
    expect(within(first).getByRole('button', { name: 'Play Submitted recording' })).toBeDisabled();
  });

  it('says a recording is gone when storage no longer holds it', async () => {
    upstream({ ...SUBMISSION, playback: { 'asset-2': SUBMISSION.playback!['asset-2']! } });
    renderPanel();

    expect(
      within(await block('Avsnitt 1')).getByText('The recording is no longer in storage.'),
    ).toBeInTheDocument();
  });

  it('still draws every recording when the exercise has been deleted', async () => {
    upstream({
      ...SUBMISSION,
      details: null,
      exercise: { ...SUBMISSION.exercise, available: false },
    });
    renderPanel();

    const first = await block('Recording 1');
    expect(within(first).getByRole('button', { name: 'Play Submitted recording' })).toBeEnabled();
    expect(
      within(first).getByText(/changed or deleted after this was handed in/),
    ).toBeInTheDocument();
    expect(within(first).getByRole('group', { name: 'Mark for Flyt' })).toBeInTheDocument();
  });

  it('shows a delivered verdict as a record: the marks and each prompt’s comment', async () => {
    upstream({
      ...SUBMISSION,
      status: 'reviewed',
      decision: {
        attemptId: 'att-1',
        outcome: 'approved',
        at: new Date().toISOString(),
        reviewerId: 't2',
        reviewerName: 'Kari Lærer',
        comment: null,
      },
      rubricMarks: { 'p1:flow': 3, 'p1:sounds': 2, 'p2:flow': 2, 'p2:sounds': 2 },
      reviewDecisions: [
        { itemId: 'p1', approved: true, comment: 'Fin flyt.' },
        { itemId: 'p2', approved: true, comment: 'Godt.' },
      ],
    });
    renderPanel();

    const first = await block('Avsnitt 1');
    expect(within(first).getByLabelText(/Feedback to the student/)).toHaveValue('Fin flyt.');
    expect(within(first).getByLabelText('5 of 6 points')).toBeInTheDocument();
    expect(within(first).getByText('Jevn flyt')).toBeInTheDocument();
    expect(
      within(first).getByRole('group', { name: 'Mark for Flyt' }).closest('fieldset'),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Approve/ })).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    upstream();
    const { container } = renderPanel();
    await block('Avsnitt 1');
    // Page-level rules are the shell's, not this fragment's.
    const rules = { rules: { region: { enabled: false } } };
    expect((await axe.run(container, rules)).violations).toEqual([]);
  });
});

describe('the reviewer’s player', () => {
  it('scrubs with the arrow keys and plays at the speed chosen', async () => {
    const user = userEvent.setup();
    upstream();
    renderPanel();

    const first = await block('Avsnitt 1');
    const audio = first.querySelector('audio')!;
    const bar = within(first).getByRole('slider', { name: 'Position in Submitted recording' });
    bar.focus();
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(audio.currentTime).toBe(5);
    fireEvent.keyDown(bar, { key: 'End' });
    expect(bar).toHaveAttribute('aria-valuetext', '0:21 of 0:21');
    fireEvent.keyDown(bar, { key: 'Home' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');

    const speed = within(first).getByRole('radiogroup', { name: 'Speed' });
    await user.click(within(speed).getByRole('radio', { name: '0.75×' }));
    expect(audio.playbackRate).toBe(0.75);
  });
});
