import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { PRACTICE_ACCENT } from './types';
import { TextOrderBody, shuffleOrder, type TextOrderContent } from './text-order-body';

const content: TextOrderContent = {
  kind: 'dialogue',
  items: [
    { id: 'a', text: 'Hi, I am Marina.', speaker: 'Marina' },
    { id: 'b', text: 'Nice to meet you.', speaker: 'Alex' },
    { id: 'c', text: 'See you around!', speaker: 'Marina' },
  ],
};

function renderBody(props: Partial<React.ComponentProps<typeof TextOrderBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TextOrderBody
        content={content}
        value={['a', 'b', 'c']}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        ok={null}
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('shuffleOrder', () => {
  it('is deterministic for the same seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffleOrder(ids, 'ex-1')).toEqual(shuffleOrder(ids, 'ex-1'));
  });

  it('keeps every item exactly once', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect([...shuffleOrder(ids, 'ex-1')].sort()).toEqual(ids);
  });

  it('never hands back the expected order', () => {
    // Two items shuffle to one of two arrangements, so this is the case where a
    // naive shuffle would give the answer away half the time.
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(shuffleOrder(['x', 'y'], seed)).not.toEqual(['x', 'y']);
    }
  });
});

describe('TextOrderBody', () => {
  it('renders the lines in the given order with their speakers', () => {
    renderBody({ value: ['c', 'a', 'b'] });

    const items = screen.getAllByRole('listitem');
    expect(items[0]!).toHaveTextContent('See you around!');
    expect(items[0]!).toHaveTextContent('Marina');
    expect(items[2]!).toHaveTextContent('Nice to meet you.');
  });

  it('moves a line down and reports the new order', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    const first = screen.getAllByRole('listitem')[0]!;
    fireEvent.click(within(first).getByLabelText('Move down'));

    expect(onValueChange).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('disables moving past either end', () => {
    renderBody();
    const items = screen.getAllByRole('listitem');

    expect(within(items[0]!).getByLabelText('Move up')).toBeDisabled();
    expect(within(items[2]!).getByLabelText('Move down')).toBeDisabled();
  });

  it('locks reordering and marks each line in the feedback phase', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: ['a', 'c', 'b'],
      results: { a: true, b: false, c: false },
    });

    expect(screen.queryByLabelText('Move up')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move down')).not.toBeInTheDocument();
    // Correct and incorrect lines are tinted differently.
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.style.background).not.toBe(items[1]!.style.background);
  });
});
