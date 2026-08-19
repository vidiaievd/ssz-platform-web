import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Translate } from '@/lib/shared-kernel/translate';

import { QueuePreview } from './queue-preview';
import { makeDoc, makeItem } from './test-doc';

function renderPreview(exercise: Translate = makeDoc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueuePreview exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

const KEY = 'Jeg har bodd i Tromsø i tre år.';

describe('QueuePreview', () => {
  it('waits for an answer rather than inventing a submission', () => {
    renderPreview();

    expect(
      screen.getByText('Write at least one answer above to see the submission.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('One submission')).not.toBeInTheDocument();
  });

  /** A hit collapses to a line: there is nothing for a teacher to do with it. */
  it('closes a hit on the key and says how much of the set is left to read', async () => {
    const { user } = renderPreview();

    await user.type(screen.getByLabelText(/Sentence 1/), KEY);

    expect(screen.getByText('1 approved automatically · 0 for you')).toBeInTheDocument();
    expect(screen.getByText('closed by the machine')).toBeInTheDocument();
    // Collapsed, so neither the diff nor the comment field is in the way.
    expect(
      screen.queryByLabelText('The answer against the key, word by word'),
    ).not.toBeInTheDocument();
  });

  it('opens up an answer that missed the key, with its diff and the key it was read against', async () => {
    const { user } = renderPreview();

    await user.type(screen.getByLabelText(/Sentence 1/), 'Jeg bor i Tromsø i tre år.');

    expect(screen.getByText('0 approved automatically · 1 for you')).toBeInTheDocument();
    expect(screen.getByLabelText('The answer against the key, word by word')).toBeInTheDocument();
    expect(screen.getByText(`closest accepted answer: ${KEY}`)).toBeInTheDocument();
    // Drawn, and inert: this submission is the author's own, with nobody to send it back to.
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(
      screen.getByText(
        'The verdict is given in Review, on the whole submission at once — these three are what waits there.',
      ),
    ).toBeInTheDocument();
  });

  /**
   * The card is the marking screen's own `SentenceRow`, so what the author is shown is
   * what the teacher will get — including where they will write about one sentence.
   */
  it('offers the per-sentence comment the teacher will have', async () => {
    const { user } = renderPreview();

    await user.type(screen.getByLabelText(/Sentence 1/), 'Jeg bor i Tromsø i tre år.');

    await user.click(screen.getByRole('button', { name: 'Comment on this sentence' }));
    await user.type(screen.getByRole('textbox', { name: 'Comment on this sentence' }), 'Tense.');

    expect(screen.getByDisplayValue('Tense.')).toBeInTheDocument();
  });

  /**
   * The teacher-side half of plan 42's error analysis: what the author wrote for this
   * sentence, and the one deviation the engine can name exactly.
   */
  it('carries the author notes and the guard that fired into the card', async () => {
    const { user } = renderPreview(
      makeDoc({
        items: [
          makeItem({
            require: [{ text: 'har bodd', note: 'The task trains the perfect tense.' }],
            teacherNote: 'Watch the tense here.',
          }),
        ],
      }),
    );

    await user.type(screen.getByLabelText(/Sentence 1/), 'Jeg bor i Tromsø i tre år.');

    expect(screen.getByText('Watch the tense here.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Missing what the task asks for: «har bodd» — The task trains the perfect tense.',
      ),
    ).toBeInTheDocument();
  });

  it('sends every answer to the teacher while the check is off', async () => {
    const { user } = renderPreview(makeDoc({ check: { ...makeDoc().check, on: false } }));

    await user.type(screen.getByLabelText(/Sentence 1/), KEY);

    expect(screen.getByText('1 answer, all for you')).toBeInTheDocument();
  });

  it('has nothing to show before the sentences are written', () => {
    renderPreview(makeDoc({ items: [] }));

    expect(
      screen.getByText('Write the sentences in step 2 to see a submission.'),
    ).toBeInTheDocument();
  });
});
