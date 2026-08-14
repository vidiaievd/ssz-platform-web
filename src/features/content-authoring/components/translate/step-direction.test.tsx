import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Translate } from '@/lib/shared-kernel/translate';

import { StepDirection } from './step-direction';
import { makeDoc, makeItem } from './test-doc';

function renderStep(exercise: Translate = makeDoc(), onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepDirection exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepDirection', () => {
  it('prints the stored template code under each direction, which is what authors file by', () => {
    renderStep();

    expect(screen.getByText('translate_from_target')).toBeInTheDocument();
    // `both` is stored under the to-target code — decision 3 of the plan, on screen.
    expect(screen.getAllByText('translate_to_target')).toHaveLength(2);
  });

  it('says which language is read and which is written, in the author’s own names', () => {
    renderStep();

    expect(screen.getByText('Reads Russisk → writes Norsk')).toBeInTheDocument();
    expect(
      screen.getByText('Every accepted translation you write in step 2 has to be in Norsk.'),
    ).toBeInTheDocument();
  });

  /** The half authors get wrong: out of Norwegian, the key is written in the other language. */
  it('turns the sentence round when the direction does', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('button', { name: /Out of Norsk/ }));

    const next = onChange.mock.calls[0]![0] as Translate;
    expect(next.dir).toBe('from_target');
    expect(next.items.every((item) => item.dir === 'from_target')).toBe(true);
  });

  it('swaps the two language labels without changing the direction', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Swap the languages' }));

    const next = onChange.mock.calls[0]![0] as Translate;
    expect(next.langs).toEqual({ explain: 'Norsk', target: 'Russisk' });
    expect(next.dir).toBe('to_target');
  });

  it('warns that a narrowed format hides sentences rather than deleting them', () => {
    renderStep(makeDoc({ format: 'single', items: [makeItem(), makeItem({ id: 'i2' })] }));

    expect(
      screen.getByText(
        '2 sentences are written, and only the first will be shown. Nothing is deleted — switch back to a set to use them again.',
      ),
    ).toBeInTheDocument();
  });

  it('marks a missing instruction on the field itself', () => {
    renderStep(makeDoc({ instructions: '  ' }));

    expect(screen.getByLabelText('Instruction')).toHaveAttribute('aria-invalid', 'true');
  });
});
