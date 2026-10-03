import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { SortIntoBucketsContent } from '@/lib/shared-kernel/sort-into-buckets';
import {
  EI,
  EN,
  ET,
  exercise,
  item,
} from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { StepFeedback } from './step-feedback';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(initial: SortIntoBucketsContent) {
  const seen: { current: SortIntoBucketsContent } = { current: initial };

  function Harness() {
    const [ex, setEx] = useState(initial);
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepFeedback
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

describe('StepFeedback', () => {
  it('counts the items that still lack their default and says so on the card (AC-F1)', () => {
    renderStep(exercise({ fb: { i1: { def: 'x', ov: {} } } }));

    expect(screen.getByText(/5 items still lack the required default/)).toBeInTheDocument();
    // The blocker is drawn on the card that owns it, not only counted.
    expect(screen.getAllByText('Explain why a wrong bucket is wrong for this item.')).toHaveLength(
      5,
    );
  });

  it('writes the default and the per-bucket text into the same field the matrix reads (AC-F2)', async () => {
    const { user, seen } = renderStep(exercise());

    await user.type(
      screen.getByLabelText('If placed in «ei»', { selector: '#sb-ov-i1-b-ei' }),
      'Not ei',
    );
    expect(seen.current.fb['i1']?.ov['b-ei']).toBe('Not ei');

    await user.click(screen.getByRole('radio', { name: 'Matrix' }));
    // The same text, reached from the other view.
    await user.click(screen.getByRole('button', { name: 'Edit the explanation for 1. bil in ei' }));
    expect(screen.getByDisplayValue('Not ei')).toBeInTheDocument();
  });

  it('locks every accepted bucket of an item in the matrix (AC-F3)', async () => {
    const { user } = renderStep(
      exercise({
        items: [
          item('i1', 'bok', EI.id, { also: [EN.id] }),
          item('i2', 'bil', EN.id),
          item('i3', 'hus', ET.id),
          item('i4', 'eple', ET.id),
        ],
      }),
    );

    await user.click(screen.getByRole('radio', { name: 'Matrix' }));

    // «bok» is accepted in ei and en: neither is a cell, only et is.
    expect(screen.getByTitle('1. bok is accepted in ei')).toBeInTheDocument();
    expect(screen.getByTitle('1. bok is accepted in en')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /explanation for 1\. bok in (ei|en)/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Write the explanation for 1. bok in et' }),
    ).toBeInTheDocument();
  });

  it('warns about a bucket with no rule but does not block (AC-F4)', () => {
    renderStep(exercise({ buckets: [EN, { ...EI, rule: '' }, ET] }));

    expect(screen.getByText(/A bucket without a rule shows nothing/)).toBeInTheDocument();
    expect(screen.queryByText(/Explain why a wrong bucket is wrong/)).not.toBeInTheDocument();
  });

  it('filters the by-item view to buckets without a text of their own', async () => {
    const { user } = renderStep(exercise({ fb: { i1: { def: 'x', ov: { [EI.id]: 'written' } } } }));
    const first = () =>
      screen.getAllByRole('listitem').find((li) => within(li).queryByText('bil'))!;

    expect(within(first()).getAllByRole('textbox')).toHaveLength(3);
    await user.click(screen.getByRole('checkbox', { name: /Only buckets without a text/ }));
    expect(within(first()).getAllByRole('textbox')).toHaveLength(2);
  });

  it('has no axe violations in either view', async () => {
    const { container, user } = renderStep(exercise());
    expect((await axe.run(container)).violations).toEqual([]);
    await user.click(screen.getByRole('radio', { name: 'Matrix' }));
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
