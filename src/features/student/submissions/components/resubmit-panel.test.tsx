import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { ResubmitPanel } from './resubmit-panel';
import type { MySubmission } from '../types';

const SUBMISSION: MySubmission = {
  id: 'att-1',
  exerciseId: 'ex-1',
  exerciseType: 'writing_task',
  targetLanguage: 'no',
  exerciseTitle: 'Et brev',
  course: 'Ny i Norge — A2',
  lesson: 'Leksjon 19',
  containerId: 'course-1',
  submittedAt: new Date().toISOString(),
  status: 'returned',
  attemptNo: 2,
  expectedResponseBy: null,
  decision: {
    verdict: 'returned',
    teacherId: 'teacher-1',
    teacherName: 'Kari Nordmann',
    at: new Date().toISOString(),
    comment: 'Se på perfektum.',
  },
  canResubmit: true,
};

interface Reply {
  status: number;
  body: unknown;
}

const ok = (body: unknown = {}): Reply => ({ status: 200, body });

/**
 * One fetch mock standing in for the three calls this panel can make: start an attempt,
 * submit into it, and — only when the submit fails — ask what became of it.
 */
function mockApi(replies: { start: Reply; submit?: Reply; state?: Reply }) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const address = String(url);
    calls.push({ url: address, body: init?.body ? JSON.parse(String(init.body)) : null });

    const reply = address.endsWith('/submit')
      ? (replies.submit ?? ok())
      : address.includes('/attempts/')
        ? (replies.state ?? ok({ status: 'IN_PROGRESS' }))
        : replies.start;

    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fetchMock, calls };
}

function renderPanel(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ResubmitPanel submission={SUBMISSION} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function write(text: string) {
  await userEvent.type(screen.getByRole('textbox'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Hand in again' }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResubmitPanel', () => {
  it('opens an attempt and submits the rewritten text into it', async () => {
    const { fetchMock, calls } = mockApi({ start: ok({ attemptId: 'att-9' }) });
    renderPanel(fetchMock);

    await write('Hei igjen');

    expect(await screen.findByText('Sent. It is with your teacher again.')).toBeInTheDocument();
    expect(calls[0]?.url).toBe('/api/exercises/ex-1/attempts');
    expect(calls[0]?.body).toMatchObject({ language: 'no' });
    expect(calls[1]?.url).toBe('/api/exercises/ex-1/attempts/att-9/submit');
    expect(calls[1]?.body).toMatchObject({ submittedAnswer: { text: 'Hei igjen' } });
  });

  /**
   * The review finding behind this step: an attempt left open by an earlier visit is not a
   * failure to report, it is the attempt this answer belongs in.
   */
  it('carries on with an attempt already in progress rather than calling it an error', async () => {
    const { fetchMock, calls } = mockApi({
      start: {
        status: 409,
        body: { error: 'An attempt is already in progress', attemptId: 'att-open' },
      },
    });
    renderPanel(fetchMock);

    await write('Hei igjen');

    expect(await screen.findByText('Sent. It is with your teacher again.')).toBeInTheDocument();
    expect(calls[1]?.url).toBe('/api/exercises/ex-1/attempts/att-open/submit');
  });

  it('reports a conflict it cannot act on as work still in hand', async () => {
    const { fetchMock } = mockApi({
      start: { status: 409, body: { error: 'An attempt is already in progress' } },
    });
    renderPanel(fetchMock);

    await write('Hei igjen');

    expect(await screen.findByText(/did not go through/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Hei igjen');
  });

  /** 47.0.B: a lost response is not a lost submission, and must not read like one. */
  it('says the work arrived when a failed submit turns out to have landed', async () => {
    const { fetchMock } = mockApi({
      start: ok({ attemptId: 'att-9' }),
      submit: { status: 502, body: { error: 'gateway' } },
      state: ok({ status: 'ROUTED_FOR_REVIEW' }),
    });
    renderPanel(fetchMock);

    await write('Hei igjen');

    expect(await screen.findByText(/already with your teacher/i)).toBeInTheDocument();
  });

  it('keeps the text when nothing left the browser, and does not promise it was lost', async () => {
    const { fetchMock } = mockApi({
      start: ok({ attemptId: 'att-9' }),
      submit: { status: 502, body: { error: 'gateway' } },
      state: { status: 502, body: { error: 'gateway' } },
    });
    renderPanel(fetchMock);

    await write('Hei igjen');

    expect(await screen.findByText(/Could not confirm/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Hei igjen');
    // 47.0.C: the answer survives the reload that follows a failure — as a draft to be
    // sent by hand, never as an outbox that speaks for the learner.
    expect(window.localStorage.getItem('exercise-answer-draft:ex-1')).toContain('Hei igjen');
  });

  it('drops the draft once the work is with the teacher', async () => {
    const { fetchMock } = mockApi({ start: ok({ attemptId: 'att-9' }) });
    renderPanel(fetchMock);

    await write('Hei igjen');

    await screen.findByText('Sent. It is with your teacher again.');
    expect(window.localStorage.getItem('exercise-answer-draft:ex-1')).toBeNull();
  });
});
