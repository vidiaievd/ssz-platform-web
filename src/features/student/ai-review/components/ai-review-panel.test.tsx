import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { AiReview } from '../types';
import { AiReviewPanel } from './ai-review-panel';

const REVIEW: AiReview = {
  outcome: 'returned',
  items: [
    {
      itemId: 'i3',
      sentenceIndex: 2,
      aspect: 'lexis',
      fragment: 'butikken',
      comment: 'Here «butikk» is indefinite.',
      suggestion: 'en butikk',
    },
    {
      itemId: 'i1',
      sentenceIndex: 0,
      aspect: 'grammar',
      fragment: 'har gå',
      comment: 'After «har» the verb takes the past participle.',
      suggestion: 'har gått',
    },
  ],
  summary: 'Almost there — two small slips.',
  marks: null,
  reading: null,
  reviewedAt: '2026-10-24T10:00:00.000Z',
  disputedAt: null,
};

/** «Jeg bor i Oslo nå.» read as «jeg bor på oslo» — `i` misread, `nå` missed. */
const READING_REVIEW: AiReview = {
  outcome: 'returned',
  items: [],
  summary: null,
  marks: null,
  reading: {
    passPercent: 85,
    prompts: [
      {
        itemId: 'p1',
        transcript: 'jeg bor på oslo',
        ops: [
          { k: 'read', i: 0, n: 1, heard: 'jeg', focus: false },
          { k: 'read', i: 1, n: 1, heard: 'bor', focus: false },
          { k: 'misread', i: 2, expected: 'i', heard: 'på', focus: false },
          { k: 'read', i: 3, n: 1, heard: 'oslo', focus: false },
          { k: 'missed', i: 4, expected: 'nå', focus: false },
        ],
        total: 5,
        read: 3,
        percent: 60,
        passed: false,
        pronunciation: null,
        wordsPerMinute: null,
      },
    ],
    carriedItemIds: ['p0'],
  },
  reviewedAt: '2026-10-27T10:00:00.000Z',
  disputedAt: null,
};

let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function renderPanel(
  templateCode = 'translate_to_target',
  extra: Partial<Parameters<typeof AiReviewPanel>[0]> = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AiReviewPanel exerciseId="ex-1" attemptId="att-1" templateCode={templateCode} {...extra} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock = vi.fn((url: string) =>
    url.endsWith('/dispute')
      ? respond(200, { disputedAt: new Date().toISOString() })
      : respond(200, REVIEW),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('AiReviewPanel (plan 79, 2.3c)', () => {
  it('says it is AI before anything loads, and keeps saying it', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderPanel();

    expect(screen.getByText('Checked by AI, not a teacher')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close|dismiss/i })).not.toBeInTheDocument();
  });

  it('keeps the label when the review cannot be loaded', async () => {
    fetchMock.mockImplementation(() => respond(502, { error: 'nope' }));
    renderPanel();

    expect(await screen.findByText('Couldn’t load the review.')).toBeInTheDocument();
    expect(screen.getByText('Checked by AI, not a teacher')).toBeInTheDocument();
  });

  it('lists the remarks in the order of the work, under the sentence they are about', async () => {
    renderPanel();

    expect(await screen.findByText('Almost there — two small slips.')).toBeInTheDocument();
    const headings = screen.getAllByText(/^Sentence \d$/).map((node) => node.textContent);
    expect(headings).toEqual(['Sentence 1', 'Sentence 3']);
    expect(screen.getByText('har gått')).toBeInTheDocument();
    expect(screen.getByText('en butikk')).toBeInTheDocument();
  });

  it('names questions on a short-answer set and nothing on an essay', async () => {
    const { unmount } = renderPanel('short_answer');
    expect(await screen.findByText('Question 1')).toBeInTheDocument();
    unmount();

    renderPanel('writing_task');
    await screen.findByText('har gått');
    expect(screen.queryByText(/^(Sentence|Question) \d$/)).not.toBeInTheDocument();
  });

  it('shows an essay’s marks with the reason for each', async () => {
    fetchMock.mockImplementation(() =>
      respond(200, {
        ...REVIEW,
        items: [],
        marks: [
          { criterionId: 'c1', criterionName: 'Task', mark: 2, reason: 'The closing is missing.' },
          { criterionId: 'c2', criterionName: null, mark: 3, reason: 'Clear.' },
        ],
      }),
    );
    renderPanel('writing_task');

    expect(await screen.findByText('Marks by criterion')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByText('The closing is missing.')).toBeInTheDocument();
    expect(screen.getByText('Unnamed criterion')).toBeInTheDocument();
    expect(screen.getByText('No remarks.')).toBeInTheDocument();
  });

  it('can hide the summary where the screen already shows it', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <AiReviewPanel
            exerciseId="ex-1"
            attemptId="att-1"
            templateCode="translate_to_target"
            showSummary={false}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    await screen.findByText('har gått');
    expect(screen.queryByText('Almost there — two small slips.')).not.toBeInTheDocument();
  });

  it('sends a dispute once, with the reason, and then only thanks', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'This review is wrong' }));
    expect(screen.getByText(/Your mark won’t change/)).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/What’s wrong with the review/),
      '  Sentence 3 is fine. ',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/You marked this review as wrong/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'This review is wrong' })).not.toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/dispute'));
    expect(call?.[0]).toBe('/api/exercises/ex-1/attempts/att-1/ai-review/dispute');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ reason: 'Sentence 3 is fine.' });
  });

  it('offers no button on a review already disputed', async () => {
    fetchMock.mockImplementation(() =>
      respond(200, { ...REVIEW, disputedAt: '2026-10-24T11:00:00.000Z' }),
    );
    renderPanel();

    expect(await screen.findByText(/You marked this review as wrong/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'This review is wrong' })).not.toBeInTheDocument();
  });

  it('keeps the form open and says so when the dispute fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/dispute') ? respond(502, { error: 'nope' }) : respond(200, REVIEW),
    );
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'This review is wrong' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(screen.getByText('Couldn’t send. Please try again.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
});

describe('AiReviewPanel — reading aloud (plan 82, step 11)', () => {
  it('draws the passage with the misread and missed words, against the pass mark', async () => {
    fetchMock.mockImplementation(() => respond(200, READING_REVIEW));
    renderPanel('read_aloud', {
      passageOf: () => 'Jeg bor i Oslo nå.',
      promptLabel: (id) => (id === 'p0' ? 'Greeting' : 'Where you live'),
    });

    expect(await screen.findByText('3 of 5 words · 60 %')).toBeInTheDocument();
    expect(screen.getByText('needs 85 %')).toBeInTheDocument();
    expect(screen.getByText('Not enough read')).toBeInTheDocument();
    // Today's passage, with its own case and punctuation.
    expect(screen.getByText('Oslo')).toBeInTheDocument();
    expect(screen.getByText('(heard as “på”)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('(missed)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('jeg bor på oslo')).toBeInTheDocument();
    expect(
      screen.getByText('Greeting — passed in an earlier try, not checked again.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/A machine listened to the recording/)).toBeInTheDocument();
  });

  it('falls back to the words of the check when the passage has changed since', async () => {
    fetchMock.mockImplementation(() => respond(200, READING_REVIEW));
    renderPanel('read_aloud', { passageOf: () => 'Jeg bor i Bergen.' });

    expect(await screen.findByText('oslo')).toBeInTheDocument();
    // Unnamed carried prompts are counted, not numbered.
    expect(
      screen.getByText('1 prompt was passed in an earlier try and not checked again.'),
    ).toBeInTheDocument();
  });

  it('shows pronunciation as a hint only', async () => {
    const prompt = READING_REVIEW.reading!.prompts[0]!;
    fetchMock.mockImplementation(() =>
      respond(200, {
        ...READING_REVIEW,
        reading: {
          ...READING_REVIEW.reading!,
          prompts: [
            {
              ...prompt,
              pronunciation: {
                accuracy: 71.6,
                fluency: 80,
                completeness: 60,
                prosody: null,
                words: [
                  { text: 'bor', accuracy: 40, error: 'mispronunciation' },
                  { text: 'jeg', accuracy: 95, error: 'none' },
                ],
              },
            },
          ],
        },
      }),
    );
    renderPanel('read_aloud');

    expect(
      await screen.findByText('accuracy 72 · fluency 80 · completeness 60'),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Unclear:/).textContent).toBe('Unclear: bor');
    expect(screen.getByText('A hint only — it does not change the result.')).toBeInTheDocument();
  });
});
