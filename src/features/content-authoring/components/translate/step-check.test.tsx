import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_CHECK, type Translate } from '@/lib/shared-kernel/translate';

import { StepCheck } from './step-check';
import { makeDoc, makeItem } from './test-doc';

function renderStep(exercise: Translate = makeDoc(), onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepCheck exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

/** The row of the routing table for one verdict. */
function routeRow(label: string): HTMLElement {
  return screen.getByText(label).closest('li')!;
}

describe('StepCheck', () => {
  /**
   * The claim the whole template rests on: one verdict can close a sentence, and the
   * other three cannot. An author who does not read this table anywhere else reads it here.
   */
  it('routes a hit on the key without a teacher and everything else to one', () => {
    renderStep();

    expect(
      within(routeRow('Identical to an accepted translation')).getByText(
        'approved without a teacher',
      ),
    ).toBeInTheDocument();

    for (const verdict of [
      'One letter off, in one word',
      'Similar enough to be close',
      'Below the threshold',
    ]) {
      expect(within(routeRow(verdict)).getByText('goes to the teacher')).toBeInTheDocument();
    }
  });

  /** The table is computed through the kernel's `route`, so a setting moves it. */
  it('sends the hit to a teacher too once approving is switched off', () => {
    renderStep(makeDoc({ check: { ...DEFAULT_CHECK, exactPass: false } }));

    expect(
      within(routeRow('Identical to an accepted translation')).getByText('goes to the teacher'),
    ).toBeInTheDocument();
  });

  it('warns where diacritic folding is switched on, not only in the finish gate', () => {
    renderStep(makeDoc({ check: { ...DEFAULT_CHECK, foldDiacritics: true } }));

    expect(
      screen.getByText('This hides real spelling mistakes: «bla» now passes for «blå».'),
    ).toBeInTheDocument();
  });

  /** With the check off there is no normalisation to tune, and nothing to approve. */
  it('replaces the check settings with what an author loses by turning it off', () => {
    renderStep(makeDoc({ check: { ...DEFAULT_CHECK, on: false } }));

    expect(screen.queryByText('Normalisation')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'With the check off nothing is approved automatically — every sentence of every submission waits for you.',
      ),
    ).toBeInTheDocument();
  });

  it('opens an empty requirement row rather than asking for the text first', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Add a requirement' }));

    expect((onChange.mock.calls[0]![0] as Translate).items[0]!.require).toEqual([{ text: '' }]);
  });

  /**
   * The note is the half that matters: «har bodd» on its own tells a student nothing, and
   * a fired guard is the only thing this engine may explain without inventing a reason.
   */
  it('writes the wording and its explanation onto the sentence', async () => {
    const { onChange, user } = renderStep(
      makeDoc({ items: [makeItem({ require: [{ text: 'har bodd' }] })] }),
    );

    await user.type(screen.getByLabelText('Required wording'), '!');
    expect((onChange.mock.calls[0]![0] as Translate).items[0]!.require[0]).toEqual({
      text: 'har bodd!',
    });

    onChange.mockClear();
    await user.type(screen.getByLabelText('Why, for the student'), 'p');
    expect((onChange.mock.calls[0]![0] as Translate).items[0]!.require[0]).toEqual({
      text: 'har bodd',
      note: 'p',
    });
  });

  /**
   * The scale of plan 42's "error analysis": how many guards say why. It is a number, not
   * a gate — nothing here refuses to publish.
   */
  it('counts the guards that carry an explanation', () => {
    renderStep(
      makeDoc({
        items: [
          makeItem({
            require: [{ text: 'har bodd', note: 'The task asks for the perfect tense.' }],
            forbid: [{ text: 'bor' }],
          }),
        ],
      }),
    );

    expect(
      screen.getByText('1 of 2 requirements have an explanation for the student.'),
    ).toBeInTheDocument();
  });

  it('says how much of the set accepts a second wording', () => {
    renderStep(
      makeDoc({
        items: [
          makeItem({ refs: ['Jeg (liker|elsker) katter.'] }),
          makeItem({ id: 'i2', source: 'Я живу тут.', refs: ['Jeg bor her.'] }),
        ],
      }),
    );

    expect(screen.getByText(/1 of 2 sentences accept more than one wording/)).toBeInTheDocument();
  });
});
