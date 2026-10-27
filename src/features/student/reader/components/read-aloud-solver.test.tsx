import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { createMockRecorder, type MockRecorder } from '@/features/student/exercises/recorder';
import {
  sampleDocument,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
} from '@/lib/shared-kernel/read-aloud';

vi.mock('@/features/learning', () => ({
  ErrorState: ({ onRetry }: { onRetry?: () => void }) => (
    <button type="button" onClick={onRetry}>
      Reload
    </button>
  ),
  LearningSkeleton: () => <div>loading</div>,
}));

const uploads: Array<{ attemptId: string; filename: string }> = [];
vi.mock('@/features/media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/media')>()),
  uploadRecording: vi.fn(async (o: { attemptId: string; filename: string }) => {
    uploads.push({ attemptId: o.attemptId, filename: o.filename });
    return { assetId: `asset-${uploads.length}` };
  }),
}));

import { ReadAloudSolver } from './read-aloud-solver';

/** One prompt, nothing before the microphone, a minimum the mock clears. */
function exercise() {
  const ex = sampleDocument();
  ex.prompts = ex.prompts.slice(0, 1).map((p) => ({ ...p, prepSeconds: 0, minSeconds: 2 }));
  ex.recording = { ...ex.recording, micCheck: false, countdown: false };
  return ex;
}
const PROJECTION = (() => {
  const ex = exercise();
  return toStudentProjection(toContent(ex), toExpectedAnswers(ex));
})();

interface ApiOptions {
  last?: unknown;
  draft?: unknown;
  assets?: Record<string, unknown>;
  submitStatus?: number;
  submitBody?: unknown;
  /** What polling the handed-in attempt answers; read on every call, so a test can move it. */
  status?: string;
  aiReview?: unknown;
}

function mockApi(options: ApiOptions = {}) {
  const submits: unknown[] = [];
  const drafts: unknown[] = [];
  const deletes: string[] = [];
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

    if (path.endsWith('/runner')) {
      return json({
        id: 'ex-1',
        templateCode: 'read_aloud',
        targetLanguage: 'nb',
        content: PROJECTION,
        expectedAnswers: {},
      });
    }
    if (path.startsWith('/api/media/assets/')) {
      const id = path.split('/').pop()!;
      if (init?.method === 'DELETE') {
        deletes.push(id);
        return new Response(null, { status: 204 });
      }
      const asset = options.assets?.[id];
      return asset === undefined ? json({ error: 'nope' }, 404) : json(asset);
    }
    if (path.endsWith('/submit')) {
      submits.push(JSON.parse(String(init?.body)));
      return json(
        options.submitBody ?? {
          attemptId: 'att-1',
          correct: false,
          score: 0,
          requiresReview: true,
        },
        options.submitStatus ?? 200,
      );
    }
    if (path.endsWith('/draft')) {
      if (init?.method === 'PUT') {
        drafts.push(JSON.parse(String(init.body)));
        return json({ savedAt: '2026-10-06T10:00:00Z' });
      }
      return json({ draftAnswer: options.draft ?? null, draftSavedAt: null });
    }
    if (path.endsWith('/ai-review')) {
      return options.aiReview === undefined
        ? json({ error: 'x', code: 'NO_AI_REVIEW' }, 404)
        : json(options.aiReview);
    }
    if (init?.method === undefined) {
      if (/\/attempts\/[^/]+$/.test(path)) return json({ status: options.status ?? 'IN_PROGRESS' });
      return json({ attempt: options.last ?? null });
    }
    return json({
      attemptId: 'att-1',
      templateCode: 'read_aloud',
      targetLanguage: 'nb',
      difficultyLevel: 'A2',
      checkMode: 'PRACTICE',
      exerciseContent: PROJECTION,
      expectedAnswers: null,
      answerSchema: {},
      checkSettings: {},
    });
  });
  return Object.assign(fetchMock, { submits, drafts, deletes });
}

let port: MockRecorder;

function renderSolver(api: ReturnType<typeof mockApi>, onChecked = vi.fn(), strict = false) {
  vi.stubGlobal('fetch', api);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const tree = (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReadAloudSolver
          exerciseId="ex-1"
          language="nb"
          onChecked={onChecked}
          createPort={() => port}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return onChecked;
}

beforeEach(() => {
  uploads.length = 0;
  port = createMockRecorder();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:take'), revokeObjectURL: vi.fn() }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function record(seconds = 20) {
  port.nextTakeSeconds(seconds);
  await userEvent.click(
    await screen.findByRole('button', { name: /^(Start recording|Record again)/ }),
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
}

describe('ReadAloudSolver', () => {
  it('opens on the card and asks for nothing until pressed', async () => {
    const api = mockApi();
    renderSolver(api);
    await screen.findByText(/reading aloud · 1 recording/);
    expect(port.calls.open).toBe(0);
    expect(api.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('opens one try however many times the effect runs (strict mode)', async () => {
    const api = mockApi();
    renderSolver(api, vi.fn(), true);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('button', { name: /^(Ready|Start recording)/ });
    const starts = api.mock.calls.filter(
      ([url, init]) => init?.method === 'POST' && String(url).endsWith('/attempts'),
    );
    expect(starts).toHaveLength(1);
  });

  it('records, uploads against the attempt, saves the draft and hands in (RA-U2, RA-R10, RA-R11)', async () => {
    const api = mockApi();
    const onChecked = renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await record();

    await waitFor(() =>
      expect(uploads).toEqual([{ attemptId: 'att-1', filename: 'p1aaaa-take-1.webm' }]),
    );
    await waitFor(() =>
      expect(api.drafts.at(-1)).toEqual({
        draftAnswer: {
          takes: { p1aaaa: [{ n: 1, assetId: 'asset-1', seconds: 20 }] },
          chosen: { p1aaaa: 0 },
        },
      }),
    );

    const send = screen.getByRole('button', { name: 'Hand in to the teacher' });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);

    await screen.findByText('Handed in.');
    expect(api.submits[0]).toMatchObject({
      submittedAnswer: {
        recordings: [{ itemId: 'p1aaaa', assetId: 'asset-1', seconds: 20, takes: 1 }],
      },
    });
    expect(onChecked).toHaveBeenCalledWith(null);
  });

  it('deletes the takes the teacher will not hear (DECISIONS §1)', async () => {
    const api = mockApi();
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await record();
    await record(25);
    await waitFor(() => expect(uploads).toHaveLength(2));
    const send = screen.getByRole('button', { name: 'Hand in to the teacher' });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);
    await screen.findByText('Handed in.');
    expect(api.submits[0]).toMatchObject({
      submittedAnswer: { recordings: [{ assetId: 'asset-2' }] },
    });
    expect(api.deletes).toEqual(['asset-1']);
  });

  it('names the prompt the engine refused (RA-U9)', async () => {
    const api = mockApi({
      submitStatus: 422,
      submitBody: { error: 'Recordings refused', code: 'RA_RECORDING_LENGTH', itemIds: ['p1aaaa'] },
    });
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await record();
    const send = screen.getByRole('button', { name: 'Hand in to the teacher' });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The recording for Avsnitt 1 has the wrong length — record it again.',
    );
  });

  it('gives a refused take back to the budget, even the last one (decided 06.10)', async () => {
    const api = mockApi({
      submitStatus: 422,
      submitBody: { error: 'Recordings refused', code: 'RA_RECORDING_FAILED', itemIds: ['p1aaaa'] },
    });
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await record();
    await record();
    await record();
    expect(await screen.findByText('You have used all 3 recordings.')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Hand in to the teacher' });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);

    expect(await screen.findByRole('alert')).toHaveTextContent('was not accepted');
    expect(
      await screen.findByRole('button', { name: 'Record again (1 left)' }),
    ).toBeInTheDocument();
    expect(api.deletes).toEqual(['asset-3']);
  });

  it('says the recordings could not be checked when media is down (RA-U10)', async () => {
    const api = mockApi({
      submitStatus: 503,
      submitBody: { error: 'x', code: 'MEDIA_UNAVAILABLE' },
    });
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await record();
    const send = screen.getByRole('button', { name: 'Hand in to the teacher' });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't be checked right now");
  });

  it('brings back the draft’s takes of this attempt and drops another attempt’s (RA-R10)', async () => {
    const api = mockApi({
      draft: {
        takes: {
          p1aaaa: [
            { n: 1, assetId: 'old', seconds: 18 },
            { n: 2, assetId: 'mine', seconds: 21 },
          ],
        },
        chosen: { p1aaaa: 1 },
      },
      assets: {
        old: { id: 'old', url: 'https://m/old', entityId: 'att-0', status: 'READY' },
        mine: {
          id: 'mine',
          url: 'https://m/mine',
          entityId: 'att-1',
          status: 'READY',
          peaks: [0.5],
        },
      },
    });
    renderSolver(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('button', { name: 'Record again (2 left)' });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Hand in to the teacher' })).toBeEnabled();
  });

  it('opens straight on «with the teacher» for work already handed in', async () => {
    const api = mockApi({
      last: {
        id: 'att-0',
        exerciseId: 'ex-1',
        templateCode: 'read_aloud',
        status: 'ROUTED_FOR_REVIEW',
        submittedAnswer: {
          recordings: [{ itemId: 'p1aaaa', assetId: 'a1', seconds: 20, takes: 1 }],
        },
      },
      assets: { a1: { id: 'a1', url: 'https://m/a1', entityId: 'att-0', status: 'READY' } },
    });
    renderSolver(api);
    await screen.findByText('Handed in.');
    expect(screen.getByText('with the teacher')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
    await act(async () => undefined);
  });

  // Plan 79, step 2.1c: read_aloud has no AI review, so self-study recordings close as NO_REVIEWER.
  it('says nobody will listen, with no «with the teacher» step, for work nobody can review', async () => {
    const api = mockApi({
      last: {
        id: 'att-0',
        exerciseId: 'ex-1',
        templateCode: 'read_aloud',
        status: 'NO_REVIEWER',
        submittedAnswer: {
          recordings: [{ itemId: 'p1aaaa', assetId: 'a1', seconds: 20, takes: 1 }],
        },
      },
      assets: { a1: { id: 'a1', url: 'https://m/a1', entityId: 'att-0', status: 'READY' } },
    });
    renderSolver(api);
    await screen.findByText('Saved.');
    expect(screen.queryByText('with the teacher')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
    await act(async () => undefined);
  });

  // Plan 82: a self-study reading is checked by the machine, and the screen waits for it.
  it('waits for the machine on a self-study reading, then shows its check', async () => {
    const handedIn = {
      id: 'att-0',
      exerciseId: 'ex-1',
      templateCode: 'read_aloud',
      status: 'ROUTED_FOR_REVIEW',
      schoolId: null,
      submittedAnswer: {
        recordings: [{ itemId: 'p1aaaa', assetId: 'a1', seconds: 20, takes: 1 }],
      },
    };
    const options: ApiOptions = {
      last: handedIn,
      status: 'ROUTED_FOR_REVIEW',
      assets: { a1: { id: 'a1', url: 'https://m/a1', entityId: 'att-0', status: 'READY' } },
    };
    const api = mockApi(options);
    renderSolver(api);
    expect(
      await screen.findByText(/The machine is listening to the recording/),
    ).toBeInTheDocument();
    expect(screen.getByText('machine is checking')).toBeInTheDocument();

    options.status = 'RETURNED';
    options.last = {
      ...handedIn,
      status: 'RETURNED',
      passed: false,
      reviewedBy: 'ai',
      reviewedAt: '2026-10-27T10:00:00Z',
      reviewDecisions: [{ itemId: 'p1aaaa', approved: false, comment: '1/3 · 33 % < 85 %' }],
      rubricMarks: {},
    };
    options.aiReview = {
      outcome: 'returned',
      items: [],
      summary: null,
      marks: null,
      reading: {
        passPercent: 85,
        prompts: [
          {
            itemId: 'p1aaaa',
            transcript: 'jeg',
            ops: [
              { k: 'read', i: 0, n: 1, heard: 'jeg', focus: false },
              { k: 'missed', i: 1, expected: 'bor', focus: false },
              { k: 'missed', i: 2, expected: 'her', focus: false },
            ],
            total: 3,
            read: 1,
            percent: 33,
            passed: false,
            pronunciation: null,
          },
        ],
        carriedItemIds: [],
      },
      reviewedAt: '2026-10-27T10:00:00Z',
      disputedAt: null,
    };

    expect(
      await screen.findByText('1 of 3 words · 33 %', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Checked by AI, not a teacher')).toBeInTheDocument();
    // The machine marked no criterion: no rubric rows at level 0, no figures twice.
    expect(screen.queryByText('1/3 · 33 % < 85 %')).toBeNull();
    expect(api.mock.calls.some(([url]) => String(url).endsWith('/attempts/att-0/ai-review'))).toBe(
      true,
    );
  });

  it('says the machine could not check it when the wait ends without a verdict', async () => {
    const handedIn = {
      id: 'att-0',
      exerciseId: 'ex-1',
      templateCode: 'read_aloud',
      status: 'ROUTED_FOR_REVIEW',
      schoolId: null,
      submittedAnswer: {
        recordings: [{ itemId: 'p1aaaa', assetId: 'a1', seconds: 20, takes: 1 }],
      },
    };
    const options: ApiOptions = {
      last: handedIn,
      status: 'NO_REVIEWER',
      assets: { a1: { id: 'a1', url: 'https://m/a1', entityId: 'att-0', status: 'READY' } },
    };
    const api = mockApi(options);
    renderSolver(api);
    await screen.findByText(/The machine is listening to the recording/);
    options.last = { ...handedIn, status: 'NO_REVIEWER' };

    expect(
      await screen.findByText(/The machine could not check the recording/, undefined, {
        timeout: 5000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record again and hand in' })).toBeInTheDocument();
  });
});
