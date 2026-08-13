import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { CharPad } from './char-pad';

/** A React-controlled field, which is the only kind this pad ever writes into. */
function Harness({ disabled = false }: { disabled?: boolean }) {
  const [text, setText] = useState('far');

  return (
    <div>
      <input aria-label="word" value={text} onChange={(event) => setText(event.target.value)} />
      <CharPad chars={['æ', 'ø', 'å']} disabled={disabled} label="Norwegian letters" />
      <span data-testid="state">{text}</span>
    </div>
  );
}

const field = () => screen.getByLabelText('word') as HTMLInputElement;

describe('CharPad', () => {
  it('writes the character into the focused field at the caret', () => {
    render(<Harness />);
    field().focus();
    field().setSelectionRange(1, 1);

    fireEvent.click(screen.getByRole('button', { name: 'å' }));

    // Not just the DOM value: the field is controlled, so this only holds if React's
    // own state moved with it.
    expect(screen.getByTestId('state')).toHaveTextContent('fåar');
    expect(field().selectionStart).toBe(2);
  });

  it('replaces the selection, the way typing the letter would', () => {
    render(<Harness />);
    field().focus();
    field().setSelectionRange(1, 3);

    fireEvent.click(screen.getByRole('button', { name: 'ø' }));

    expect(screen.getByTestId('state')).toHaveTextContent('fø');
  });

  it('keeps the field focused rather than stealing it on mouse-down', () => {
    render(<Harness />);
    field().focus();

    const prevented = !fireEvent.mouseDown(screen.getByRole('button', { name: 'æ' }));

    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(field());
  });

  it('does nothing at all when no field has focus', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'æ' }));

    expect(screen.getByTestId('state')).toHaveTextContent('far');
  });

  it('is plainly off when there is nothing to write into', () => {
    render(<Harness disabled />);

    expect(screen.getByRole('button', { name: 'æ' })).toBeDisabled();
  });
});
