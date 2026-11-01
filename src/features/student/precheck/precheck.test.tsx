import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { PrecheckButton, PrecheckResultPanel } from './precheck-control';
import { usePrecheckRun } from './use-precheck-run';

const OK = {
  attemptId: 'att-1',
  templateCode: 'writing_task',
  selfCheck: null,
  ai: { status: 'ok' },
  feedback: {
    summary: 'Two small slips.',
    items: [
      {
        kind: 'grammar',
        original: 'har gå',
        suggestion: 'har gått',
        explanation: 'After «har» the verb takes the participle.',
        severity: 'major',
      },
    ],
    words: [],
  },
  reading: null,
  remaining: { exercise: 2, learnerChecksApprox: 7 },
};

function Harness({ draft }: { draft: unknown }) {
  const run = usePrecheckRun('ex-1', 'att-1');
  return (
    <>
      <PrecheckButton run={run} draft={draft} />
      <PrecheckResultPanel run={run} />
    </>
  );
}

const mount = (draft: unknown = { text: 'Jeg har gå.' }) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness draft={draft} />
    </NextIntlClientProvider>,
  );

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('«Check» before hand-in', () => {
  it('sends the draft to the attempt and draws the model’s remarks under the label that says whose they are', async () => {
    const fetchMock = reply(200, OK);
    vi.stubGlobal('fetch', fetchMock);
    mount();

    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Two small slips.')).toBeInTheDocument();
    expect(screen.getByText(/har gå\s+→\s+har gått/)).toBeInTheDocument();
    expect(screen.getByText(/your teacher sets the grade/i)).toBeInTheDocument();
    expect(screen.getByText('About 2 checks left')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exercises/ex-1/attempts/att-1/check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ draftAnswer: { text: 'Jeg har gå.' } }),
      }),
    );
  });

  it('has nothing to check while the draft is empty', () => {
    vi.stubGlobal('fetch', reply(200, OK));
    mount(null);

    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('says why when the limit is spent, and the button stays off', async () => {
    vi.stubGlobal(
      'fetch',
      reply(200, {
        ...OK,
        ai: { status: 'refused', reason: 'exercise_limit' },
        feedback: null,
        remaining: { exercise: 0, learnerChecksApprox: 5 },
      }),
    );
    mount();

    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText(/used all the checks for this exercise/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('puts the button away when the school or the plan says no', async () => {
    vi.stubGlobal('fetch', reply(403, { error: 'Check not available' }));
    mount();

    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Check' })).toBeNull());
  });

  it('leaves the button for another try when the request merely fails', async () => {
    vi.stubGlobal('fetch', reply(502, { error: 'Could not check the work' }));
    mount();

    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText(/Couldn't check just now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });
});
