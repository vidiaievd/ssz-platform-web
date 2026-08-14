import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Translate } from '@/lib/shared-kernel/translate';

import { TrTester } from './tr-tester';
import { makeDoc, makeItem } from './test-doc';

function renderTester(exercise: Translate = makeDoc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TrTester exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

const answer = (user: ReturnType<typeof userEvent.setup>, text: string) =>
  user.type(screen.getByLabelText('Answer in Norsk'), text);

describe('TrTester', () => {
  it('says nothing until an answer is written', () => {
    renderTester();

    expect(screen.getByText('Write an answer above to see where it would land.')).toBeInTheDocument();
  });

  it('approves a hit on the key without a teacher', async () => {
    const { user } = renderTester();

    await answer(user, 'Jeg har bodd i Tromsø i tre år.');

    expect(screen.getByText('Matches the key')).toBeInTheDocument();
    expect(screen.getByText('approved without a teacher')).toBeInTheDocument();
  });

  /**
   * The reason the tester exists: a perfectly good translation the author did not write
   * down is not marked wrong, it is queued — and the author only feels that by trying one.
   */
  it('sends an honest second translation to the teacher, and never calls it wrong', async () => {
    const { user } = renderTester();

    await answer(user, 'Jeg bodde i Tromsø i tre år.');

    expect(screen.getByText('goes to the teacher')).toBeInTheDocument();
    // The verdict is a distance from the key, not a judgement of the translation.
    expect(screen.getByText('Close to the key')).toBeInTheDocument();
  });

  it('shows the key it compared against, and the diff against it', async () => {
    const { user } = renderTester();

    await answer(user, 'Jeg bor i Tromsø.');

    expect(screen.getByText('Closest accepted translation')).toBeInTheDocument();
    expect(
      screen.getByLabelText('The answer against the key, word by word'),
    ).toBeInTheDocument();
  });

  /** Guards are the one deviation the machine may name — with the author's own reason. */
  it('reports a guard the answer misses, with the note attached to it', async () => {
    const { user } = renderTester(
      makeDoc({
        items: [
          makeItem({
            require: [{ text: 'har bodd', note: 'The exercise practises the perfect.' }],
          }),
        ],
      }),
    );

    await answer(user, 'Jeg bodde i Tromsø i tre år.');

    expect(
      screen.getByText(
        'Missing what the task asks for: «har bodd» — The exercise practises the perfect.',
      ),
    ).toBeInTheDocument();
  });

  it('reports a forbidden wording the answer uses', async () => {
    const { user } = renderTester(
      makeDoc({ items: [makeItem({ forbid: [{ text: 'bor' }] })] }),
    );

    await answer(user, 'Jeg bor i Tromsø i tre år.');

    expect(screen.getByText('Uses a forbidden wording: «bor»')).toBeInTheDocument();
  });

  it('offers only the sentences a student would actually be given', () => {
    renderTester(
      makeDoc({
        format: 'single',
        items: [makeItem(), makeItem({ id: 'i2', source: 'Я люблю кошек.' })],
      }),
    );

    expect(screen.queryByLabelText('Sentence to try')).not.toBeInTheDocument();
  });
});
