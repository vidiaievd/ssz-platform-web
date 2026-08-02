import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import {
  SentenceSchemaBody,
  type SentenceSchemaContent,
  type SchemaPlacements,
} from './sentence-schema-body';

const messages = {
  ExerciseRunner: {
    sentenceSchema: {
      defaultInstruction: 'Place each word in the right field',
      bankLabel: 'Words',
      bankEmpty: 'All words placed',
      fieldDropLabel: 'Place in {field}',
    },
  },
};

const CONTENT: SentenceSchemaContent = {
  sentence: 'Lars har likt Lotte',
  fields: [
    { id: 'f1', label: 'Forfelt' },
    { id: 'f2', label: 'Verbal' },
  ],
  tokens: [
    { id: 't1', text: 'Lars' },
    { id: 't2', text: 'har' },
  ],
};
const ACCENT = 'var(--ssz-color-primary-500)';

/** jsdom has no layout, so drop hit-testing needs hand-fed geometry. */
function stubRect(el: Element, r: { left: number; top: number; right: number; bottom: number }) {
  const rect = {
    ...r,
    width: r.right - r.left,
    height: r.bottom - r.top,
    x: r.left,
    y: r.top,
    toJSON: () => r,
  } as DOMRect;
  el.getBoundingClientRect = () => rect;
}

function Harness({ onAnswerChange }: { onAnswerChange?: (canSubmit: boolean) => void }) {
  const [value, setValue] = useState<SchemaPlacements>({});
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <SentenceSchemaBody
        content={CONTENT}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange ?? (() => {})}
        phase="answering"
        ok={null}
        mode="practice"
        accent={ACCENT}
      />
    </NextIntlClientProvider>
  );
}

describe('SentenceSchemaBody', () => {
  it('renders the sentence, field labels and token bank', () => {
    render(<Harness />);
    expect(screen.getByText('Lars har likt Lotte')).toBeInTheDocument();
    expect(screen.getByText('Forfelt')).toBeInTheDocument();
    expect(screen.getByText('Verbal')).toBeInTheDocument();
    // Tokens start in the bank.
    expect(screen.getByRole('button', { name: 'Lars' })).toBeInTheDocument();
  });

  it('places an armed token into a field on tap and reports progress', () => {
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);

    // Arm "Lars" then tap the Forfelt drop zone.
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(screen.getByLabelText('Place in Forfelt'));
    // Arm "har" then tap the Verbal drop zone → all tokens placed.
    fireEvent.click(screen.getByRole('button', { name: 'har' }));
    fireEvent.click(screen.getByLabelText('Place in Verbal'));

    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('All words placed')).toBeInTheDocument();
  });

  it('returns a placed token to the bank when tapped', () => {
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(screen.getByLabelText('Place in Forfelt'));
    // "Lars" is now placed (a chip inside the field). Tap to remove.
    const placed = screen.getByRole('button', { name: 'Lars' });
    fireEvent.click(placed);
    // Back in the bank, still selectable; not all placed.
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps placed tokens interactive while no token is armed', () => {
    // Regression: the drop zone used to be a <button disabled> whenever nothing
    // was armed, and browsers swallow events for descendants of a disabled
    // button — a misplaced word could never be taken back out.
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(screen.getByLabelText('Place in Forfelt'));

    const placed = screen.getByRole('button', { name: 'Lars' });
    expect(placed).toBeEnabled();
    for (let el = placed.parentElement; el; el = el.parentElement) {
      expect(el.tagName === 'BUTTON' && el.hasAttribute('disabled')).toBe(false);
    }
  });

  it('drags a token from the bank into a field', () => {
    render(<Harness />);
    const zone = screen.getByLabelText('Place in Verbal');
    stubRect(zone, { left: 200, top: 0, right: 320, bottom: 60 });

    const chip = screen.getByRole('button', { name: 'har' });
    stubRect(chip, { left: 0, top: 100, right: 60, bottom: 130 });

    fireEvent.pointerDown(chip, { pointerId: 1, clientX: 10, clientY: 110, pointerType: 'mouse', button: 0 });
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 240, clientY: 30 });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 240, clientY: 30 });

    // The chip now lives inside the Verbal zone instead of the bank.
    expect(zone).toContainElement(screen.getByRole('button', { name: 'har' }));
  });

  it('drops a token before an existing one to fix the order inside a field', () => {
    render(<Harness />);
    const zone = screen.getByLabelText('Place in Verbal');
    stubRect(zone, { left: 200, top: 0, right: 320, bottom: 60 });

    // Place "Lars" first, so the field reads [Lars].
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(zone);
    stubRect(screen.getByRole('button', { name: 'Lars' }), { left: 250, top: 10, right: 310, bottom: 40 });

    // Drag "har" onto the left half of "Lars" → it must land in front of it.
    const har = screen.getByRole('button', { name: 'har' });
    stubRect(har, { left: 0, top: 100, right: 60, bottom: 130 });
    fireEvent.pointerDown(har, { pointerId: 2, clientX: 10, clientY: 110, pointerType: 'mouse', button: 0 });
    fireEvent.pointerMove(har, { pointerId: 2, clientX: 260, clientY: 25 });
    fireEvent.pointerUp(har, { pointerId: 2, clientX: 260, clientY: 25 });

    const texts = Array.from(zone.querySelectorAll('button')).map((b) => b.textContent);
    expect(texts).toEqual(['har', 'Lars']);
  });

  it('drags a placed token back to the bank when dropped outside every field', () => {
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);
    const zone = screen.getByLabelText('Place in Forfelt');
    stubRect(zone, { left: 0, top: 0, right: 120, bottom: 60 });
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(zone);

    const placed = screen.getByRole('button', { name: 'Lars' });
    stubRect(placed, { left: 20, top: 10, right: 80, bottom: 40 });
    fireEvent.pointerDown(placed, { pointerId: 3, clientX: 30, clientY: 20, pointerType: 'mouse', button: 0 });
    fireEvent.pointerMove(placed, { pointerId: 3, clientX: 30, clientY: 400 });
    fireEvent.pointerUp(placed, { pointerId: 3, clientX: 30, clientY: 400 });

    expect(zone).not.toContainElement(screen.getByRole('button', { name: 'Lars' }));
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
  });
});
