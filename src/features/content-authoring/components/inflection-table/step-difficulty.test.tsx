import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { sampleContent, type InflectionTableContent } from '@/lib/shared-kernel/inflection-table';

import { StepDifficulty } from './step-difficulty';

function renderStep(initial: InflectionTableContent) {
  const seen: { current: InflectionTableContent } = { current: initial };
  function Harness() {
    const [ex, setEx] = useState(initial);
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepDifficulty
          exercise={ex}
          onChange={(next) => {
            seen.current = next;
            setEx(next);
          }}
        />
      </NextIntlClientProvider>
    );
  }
  const view = render(<Harness />);
  return { user: userEvent.setup(), seen, ...view };
}

const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };
const bank = (ex = sampleContent()): InflectionTableContent => ({
  ...ex,
  input: { ...ex.input, mode: 'bank' },
});

describe('StepDifficulty — how the student answers', () => {
  it('switches between typing and a bank, and says what each means', async () => {
    const { user, seen } = renderStep(sampleContent());
    expect(
      screen.getByText('The student produces the letters. Nothing is offered.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Pick from a bank' }));
    expect(seen.current.input.mode).toBe('bank');
    expect(screen.getByText('Forms are offered — this is recognition.')).toBeInTheDocument();
  });

  it('says the bank proves less than production, and nothing caps typing (IT-B11, deviation 6)', async () => {
    const { user } = renderStep(sampleContent());
    expect(screen.getByTestId('it-ceiling')).toHaveTextContent('nothing here caps it');
    await user.click(screen.getByRole('radio', { name: 'Pick from a bank' }));
    expect(screen.getByTestId('it-ceiling')).toHaveTextContent('proves less than production');
  });

  it('offers the extra-forms dial only for a bank, 0–5', () => {
    const { unmount } = renderStep(sampleContent());
    expect(screen.queryByRole('slider', { name: /Extra forms/ })).not.toBeInTheDocument();
    unmount();
    const { seen } = renderStep(bank());
    const dial = screen.getByRole('slider', { name: /Extra forms in the bank — 3/ });
    expect(dial).toHaveAttribute('max', '5');
    fireEvent.change(dial, { target: { value: '5' } });
    expect(seen.current.input.bankExtra).toBe(5);
  });

  it('warns about a bank with no distractors', () => {
    renderStep(
      bank({ ...sampleContent(), input: { mode: 'bank', bankExtra: 0, shuffleRows: true } }),
    );
    expect(screen.getByText(/A word bank with no extra forms/)).toBeInTheDocument();
  });

  it('toggles shuffling and the first-letter hint, and says the hint lowers the ceiling', async () => {
    const { user, seen } = renderStep(sampleContent());
    expect(screen.queryByTestId('it-hint-ceiling')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /First letter as a hint/ }));
    expect(seen.current.settings.hintFirstLetter).toBe(true);
    expect(screen.getByTestId('it-hint-ceiling')).toHaveTextContent('first letter');
    await user.click(screen.getByRole('switch', { name: /Shuffle rows per attempt/ }));
    expect(seen.current.input.shuffleRows).toBe(false);
  });
});

describe('StepDifficulty — marking', () => {
  it('moves attempts 1–4 and the threshold 50–100 in steps of five', () => {
    const { seen } = renderStep(sampleContent());
    const attempts = screen.getByRole('slider', { name: /Attempts — 2/ });
    expect([attempts.getAttribute('min'), attempts.getAttribute('max')]).toEqual(['1', '4']);
    fireEvent.change(attempts, { target: { value: '4' } });
    expect(seen.current.settings.attempts).toBe(4);

    const pass = screen.getByRole('slider', { name: /Pass threshold — 75% of asked cells/ });
    expect([pass.getAttribute('min'), pass.getAttribute('step')]).toEqual(['50', '5']);
    fireEvent.change(pass, { target: { value: '90' } });
    expect(seen.current.settings.threshold).toBe(90);
  });

  it('toggles the row verdict and picks when the paradigm is shown', async () => {
    const { user, seen } = renderStep(sampleContent());
    await user.click(screen.getByRole('switch', { name: /Verdict per row/ }));
    expect(seen.current.settings.rowVerdict).toBe(false);
    await user.click(screen.getByRole('radio', { name: 'After the first' }));
    expect(seen.current.settings.revealKey).toBe('afterFirst');
  });

  it('says so when the key is never shown', async () => {
    const { user } = renderStep(sampleContent());
    await user.click(screen.getByRole('radio', { name: 'Never' }));
    expect(screen.getByText(/The key is never shown/)).toBeInTheDocument();
  });

  it('has no axe violations, typing or bank', async () => {
    const typing = renderStep(sampleContent());
    expect((await axe.run(typing.container, PAGE_RULES)).violations).toEqual([]);
    typing.unmount();
    const banked = renderStep(bank());
    expect((await axe.run(banked.container, PAGE_RULES)).violations).toEqual([]);
  });
});
