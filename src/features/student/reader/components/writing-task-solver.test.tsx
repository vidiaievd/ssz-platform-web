import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { WritingTaskSolver } from './writing-task-solver';

/** The task as the server projects it — no keywords, no model answer. */
const PROJECTION = {
  mode: 'letter',
  instruction: 'Skriv et brev til kommunen.',
  prompt: 'Svømmehallen skal stenge.',
  letter: { recipient: 'Oslo kommune', register: 'formal' },
  points: [{ id: 'p1', text: 'Presenter deg selv', required: true }],
  phrases: [],
  rubricMax: 15,
  settings: {
    minWords: 5,
    maxWords: 0,
    timer: 0,
    blockPaste: false,
    autosave: true,
    showWordCount: true,
    showPlan: true,
    showPhrases: false,
    showRubric: 'afterGraded',
    showModel: 'afterGraded',
    passScore: 8,
    revision: 'return',
  },
};

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'writing_task',
  targetLanguage: 'nb',
  difficultyLevel: 'B1',
  checkMode: 'GRADED',
  exerciseContent: PROJECTION,
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

/** A written text is never auto-judged: routed, always. */
const ROUTED = {
  attemptId: 'att-1',
  correct: false,
  score: null,
  requiresReview: true,
  feedback: { summary: 'Your answer has been submitted for review.' },
};

function attemptRecord(over: Record<string, unknown> = {}) {
  return {
    attempt: {
      id: 'att-0',
      exerciseId: 'ex-1',
      templateCode: 'writing_task',
      status: 'ROUTED_FOR_REVIEW',
      checkMode: 'GRADED',
      score: null,
      passed: null,
      answersRevealed: false,
      submittedAnswer: { text: 'Levert tekst fra i går', ticked: [] },
      validationDetails: null,
      submittedAt: '2026-08-21T10:00:00.000Z',
      scoredAt: null,
      reviewComment: null,
      ...over,
    },
  };
}

function mockApi(
  responses: {
    started?: unknown;
    startFails?: boolean;
    submit?: unknown;
    submitFails?: boolean;
    last?: unknown;
    draft?: unknown;
    draftPutFails?: boolean;
    attemptStatus?: unknown;
  } = {},
) {
  const calls: Array<{ path: string; method: string; body: unknown }> = [];

  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? 'GET';
    calls.push({
      path,
      method,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });

    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/draft')) {
      if (method === 'PUT') {
        return responses.draftPutFails
          ? json({ error: 'nope' }, 502)
          : json({ savedAt: '2026-08-22T09:00:00.000Z' });
      }
      return json(responses.draft ?? { draftAnswer: null, draftSavedAt: null });
    }
    if (path.endsWith('/submit')) {
      return responses.submitFails
        ? json({ error: 'nope' }, 502)
        : json(responses.submit ?? ROUTED);
    }
    if (method === 'GET') {
      // `GET .../attempts/<id>` is the 47.0.B status check; `GET .../attempts` is the
      // last-finished-attempt lookup.
      if (/\/attempts\/[^/]+$/.test(path)) {
        return json(responses.attemptStatus ?? { status: 'IN_PROGRESS' });
      }
      return json(responses.last ?? { attempt: null });
    }
    if (responses.startFails) return json({ error: 'nope' }, 502);
    return json(responses.started ?? STARTED);
  });

  return { fetchMock, calls };
}

function renderSolver(
  fetchMock: ReturnType<typeof mockApi>['fetchMock'],
  onChecked?: (ok: boolean | null) => void,
) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WritingTaskSolver
          exerciseId="ex-1"
          language="nb"
          {...(onChecked === undefined ? {} : { onChecked })}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const field = () => screen.getByRole('textbox', { name: 'Your text' });
const write = (text: string) => fireEvent.change(field(), { target: { value: text } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('WritingTaskSolver', () => {
  it('opens the attempt and shows the task', async () => {
    const { fetchMock } = mockApi();
    renderSolver(fetchMock);

    expect(await screen.findByText('Svømmehallen skal stenge.')).toBeInTheDocument();
    expect(screen.getByText(/Oslo kommune/)).toBeInTheDocument();
  });

  it('refuses a task that arrived with its answer key still attached', async () => {
    // Not a broken payload — it would render perfectly. It is an engine that did not
    // project, which also means the model answer is in the page.
    const { fetchMock } = mockApi({
      started: {
        ...STARTED,
        exerciseContent: {
          ...PROJECTION,
          model: 'Hei, jeg heter Anna…',
          points: [{ id: 'p1', text: 'Presenter deg selv', required: true, keywords: ['heter'] }],
        },
      },
    });
    renderSolver(fetchMock);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('offers a retry when the attempt cannot be opened', async () => {
    const { fetchMock } = mockApi({ startFails: true });
    renderSolver(fetchMock);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('keeps the hand-in locked until the text is long enough, and says how much is left', async () => {
    const { fetchMock } = mockApi();
    renderSolver(fetchMock);
    await screen.findByRole('textbox', { name: 'Your text' });

    const button = screen.getByRole('button', { name: 'Hand in to the teacher' });
    expect(button).toBeDisabled();

    write('ett to tre');
    expect(screen.getByText('At least 5 words required — 2 to go')).toBeInTheDocument();
    expect(button).toBeDisabled();

    write('ett to tre fire fem');
    expect(button).toBeEnabled();
    expect(screen.getByText('Every submission is read by a teacher')).toBeInTheDocument();
  });

  it('hands the text in and waits for a person, reporting no verdict of its own', async () => {
    const { fetchMock, calls } = mockApi();
    const onChecked = vi.fn();
    renderSolver(fetchMock, onChecked);
    await screen.findByRole('textbox', { name: 'Your text' });

    write('ett to tre fire fem');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    expect(await screen.findByText('Handed in.')).toBeInTheDocument();
    // The text becomes a quote; there is nothing left to edit.
    expect(screen.queryByRole('textbox', { name: 'Your text' })).not.toBeInTheDocument();
    // `null`, never true or false: nothing here judged the writing.
    expect(onChecked).toHaveBeenCalledWith(null);

    const submitted = calls.find((c) => c.path.endsWith('/submit'));
    expect(submitted?.body).toMatchObject({
      submittedAnswer: { text: 'ett to tre fire fem', ticked: [] },
    });
  });

  it('autosaves the text once the typing stops, not once per keystroke', async () => {
    vi.useFakeTimers();
    const { fetchMock, calls } = mockApi();
    renderSolver(fetchMock);
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Your text' })).toBeTruthy());

    write('Hei');
    write('Hei Kari');
    write('Hei Kari, jeg skriver');
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1500);

    const saves = calls.filter((c) => c.method === 'PUT' && c.path.endsWith('/draft'));
    expect(saves).toHaveLength(1);
    expect(saves[0]?.body).toMatchObject({
      draftAnswer: { text: 'Hei Kari, jeg skriver', ticked: [] },
    });
  });

  it('says the draft is saved only once the server has taken it', async () => {
    vi.useFakeTimers();
    const { fetchMock } = mockApi();
    renderSolver(fetchMock);
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Your text' })).toBeTruthy());

    write('Hei Kari');
    expect(screen.getByText('Saving…')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1500);
    await vi.waitFor(() => expect(screen.getByText('Draft saved')).toBeTruthy());
  });

  it('stays quiet about a failed background save — the text is on the screen either way', async () => {
    vi.useFakeTimers();
    const { fetchMock } = mockApi({ draftPutFails: true });
    renderSolver(fetchMock);
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Your text' })).toBeTruthy());

    write('Hei Kari');
    await vi.advanceTimersByTimeAsync(1500);

    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your text' })).toHaveValue('Hei Kari');
  });

  it('brings back the draft left on the attempt', async () => {
    const { fetchMock } = mockApi({
      draft: {
        draftAnswer: { text: 'Halvferdig brev', ticked: ['p1'] },
        draftSavedAt: '2026-08-22T08:00:00.000Z',
      },
    });
    renderSolver(fetchMock);

    await waitFor(() => expect(field()).toHaveValue('Halvferdig brev'));
    expect(screen.getByRole('checkbox', { name: /Presenter deg selv/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('shows work already handed in as handed in, not as a draft to redo', async () => {
    const { fetchMock } = mockApi({
      last: attemptRecord(),
      draft: { draftAnswer: { text: 'eldre utkast' }, draftSavedAt: '2026-08-20T08:00:00.000Z' },
    });
    renderSolver(fetchMock);

    expect(await screen.findByText('Handed in.')).toBeInTheDocument();
    // Handed-in work outranks the draft that produced it.
    expect(screen.getByText('Levert tekst fra i går')).toBeInTheDocument();
    expect(screen.queryByText('eldre utkast')).not.toBeInTheDocument();
  });

  it("shows the teacher's verdict when the learner comes back to a graded attempt", async () => {
    const { fetchMock } = mockApi({
      last: attemptRecord({
        status: 'SCORED',
        score: 73,
        passed: true,
        reviewComment: 'Bra jobbet, Anna!',
        scoredAt: '2026-08-21T18:00:00.000Z',
      }),
    });
    renderSolver(fetchMock);

    expect(await screen.findByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Bra jobbet, Anna!')).toBeInTheDocument();
    // A pass is the end of it; there is nothing to rewrite.
    expect(screen.queryByRole('button', { name: /Rewrite/ })).not.toBeInTheDocument();
  });

  it('draws the rubric the teacher marked, not a percentage', async () => {
    const { fetchMock } = mockApi({
      last: attemptRecord({
        status: 'SCORED',
        score: 89,
        passed: true,
        reviewComment: 'Bra jobbet!',
        rubricSnapshot: {
          criteria: [
            {
              id: 'c1',
              name: 'Innhold',
              desc: 'Alle punktene er med',
              weight: 2,
              levels: ['Mangler', 'Delvis', 'Nesten alt', 'Alle punktene er dekket'],
            },
          ],
          passScore: 4,
        },
        rubricMarks: { c1: 3 },
      }),
    });
    renderSolver(fetchMock);

    expect(await screen.findByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('6 / 6 points')).toBeInTheDocument();
    // The descriptor for the mark given — the sentence the author wrote for that level.
    expect(screen.getByText('Alle punktene er dekket')).toBeInTheDocument();
  });

  it('offers a rewrite after a returned verdict, and opens a fresh attempt for it', async () => {
    const { fetchMock } = mockApi({
      last: attemptRecord({
        status: 'RETURNED',
        passed: false,
        reviewComment: 'Se på verbtiden i andre avsnitt.',
      }),
    });
    renderSolver(fetchMock);

    await userEvent.click(await screen.findByRole('button', { name: /Rewrite and hand in again/ }));

    // A blank field for the new attempt: the submitted text is what the teacher read and
    // commented on, and it stays as it was.
    await waitFor(() => expect(field()).toHaveValue(''));
    expect(screen.getByText(/submission 2/)).toBeInTheDocument();
  });

  it('resolves a failed hand-in against the server before saying anything', async () => {
    const { fetchMock } = mockApi({
      submitFails: true,
      attemptStatus: { status: 'ROUTED_FOR_REVIEW' },
    });
    renderSolver(fetchMock);
    await screen.findByRole('textbox', { name: 'Your text' });

    write('ett to tre fire fem');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    // Only the response was lost: the work is with the teacher, and a second send would
    // hand in what is already there.
    expect(await screen.findByText('Handed in.')).toBeInTheDocument();
  });

  it('asks for another try when the hand-in never landed', async () => {
    const { fetchMock } = mockApi({ submitFails: true, attemptStatus: { status: 'IN_PROGRESS' } });
    renderSolver(fetchMock);
    await screen.findByRole('textbox', { name: 'Your text' });

    write('ett to tre fire fem');
    await userEvent.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));

    expect(await screen.findByText('The text was not handed in. Try again.')).toBeInTheDocument();
    expect(field()).toHaveValue('ett to tre fire fem');
  });
});
