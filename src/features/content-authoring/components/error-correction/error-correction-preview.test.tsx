import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  type ErrorCorrection,
  type Item,
} from '@/lib/shared-kernel/error-correction';

import { ErrorCorrectionPreview } from './error-correction-preview';

const item = (id: string, wrong: string, ref: string): Item => ({
  id,
  wrong,
  ref,
  alts: [],
  meta: {},
});

const PAIR = item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.');

function doc(overrides: Partial<ErrorCorrection> = {}): ErrorCorrection {
  return {
    id: 'ex-1',
    type: 'error_correction',
    moduleId: 'module-1',
    title: '',
    instructions: 'Finn feilen.',
    mode: 'sentences',
    note: '',
    items: [PAIR],
    hints: { ...DEFAULT_HINTS },
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
    updatedAt: '2026-08-12T10:00:00.000Z',
    ...overrides,
  };
}

function renderPreview(exercise: ErrorCorrection = doc()) {
  const { rerender } = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ErrorCorrectionPreview exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return {
    user: userEvent.setup(),
    update: (next: ErrorCorrection) =>
      rerender(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <ErrorCorrectionPreview exercise={next} />
        </NextIntlClientProvider>,
      ),
  };
}

describe('ErrorCorrectionPreview', () => {
  it('shows the faulty sentence and never the answer key', () => {
    renderPreview();

    expect(screen.getByRole('button', { name: 'Word: jeg' })).toBeInTheDocument();
    // The words are tappable, so the column says up front that nothing here is checked.
    expect(screen.getByText(/nothing you correct here is checked/)).toBeInTheDocument();
    expect(screen.getByText('1 mistake to find')).toBeInTheDocument();
    expect(screen.queryByText(/gikk jeg/)).not.toBeInTheDocument();
  });

  it('clears what was tried in it when the sentence is rewritten', async () => {
    const { user, update } = renderPreview();

    await user.click(screen.getByRole('button', { name: 'Word: kino.' }));
    await user.type(screen.getByRole('textbox'), 'teater.{Enter}');
    expect(screen.getByText('1 change')).toBeInTheDocument();

    // The author carries on writing. The mark was made on the old words, and every index
    // in it points into them — left in place it would sit on a different word.
    update(doc({ items: [{ ...PAIR, wrong: 'I går jeg gikk på kino i går.' }] }));

    expect(screen.getByText('no changes')).toBeInTheDocument();
    expect(screen.queryByText('teater.')).not.toBeInTheDocument();
  });

  it('keeps what was tried while the author edits something the student never sees', async () => {
    const { user, update } = renderPreview();

    await user.click(screen.getByRole('button', { name: 'Word: kino.' }));
    await user.type(screen.getByRole('textbox'), 'teater.{Enter}');

    // The answer key is not in the projection, so a preview attempt survives editing it.
    update(doc({ items: [{ ...PAIR, ref: 'I går gikk jeg på teater.' }] }));

    expect(screen.getByText('1 change')).toBeInTheDocument();
  });

  it('says what is missing rather than rendering an empty runner', () => {
    renderPreview(doc({ items: [] }));

    expect(screen.getByText(/Write a sentence with a mistake/)).toBeInTheDocument();
  });
});
