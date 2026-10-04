import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MarkableText, type MarkCell } from './markable-text';

// I(0) fjor(1) sommer(2) reiste(3) vi(4) til(5) Bodø(6) og(7) vi(8) gikk(9) på(10) tur(11)
// ¶ Det(12) var(13) kaldt(14) men(15) fint(16)
const TEXT = 'I fjor sommer reiste vi til Bodø, og vi gikk på tur.\n\nDet var kaldt, men fint.';

const token = (i: number) => document.querySelector<HTMLElement>(`[data-i="${i}"]`)!;
const cellsOf =
  (map: Record<number, MarkCell>) =>
  (i: number): MarkCell | null =>
    map[i] ?? null;

describe('MarkableText — rendering', () => {
  it('draws one paragraph per blank line and every word as a token', () => {
    const { container } = render(<MarkableText text={TEXT} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelectorAll('[data-i]')).toHaveLength(17);
    expect(container.textContent).toBe(TEXT.replace('\n\n', ''));
  });

  it('is read-only by default: no buttons, nothing in the tab order', () => {
    render(<MarkableText text={TEXT} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(token(0).getAttribute('data-live')).toBe('false');
  });

  it('makes every token a toggle button when live, pressed when marked (BEHAVIOR §8)', () => {
    render(<MarkableText text={TEXT} live cellOf={cellsOf({ 3: { m: 'sel', k: 'a' } })} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(17);
    expect(screen.getByRole('button', { name: 'reiste' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'sommer' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('labels the passage by the prompt', () => {
    render(
      <>
        <p id="prompt">Finn verbene.</p>
        <MarkableText text={TEXT} live labelledBy="prompt" />
      </>,
    );
    expect(screen.getByRole('group', { name: 'Finn verbene.' })).toBeInTheDocument();
  });

  it('rounds a run only at its ends and tints the punctuation inside it, not at its edge (AC-M2)', () => {
    const run = { m: 'key' as const, k: 'r' };
    // «Bodø, og» marked as one run, and «tur» alone before its full stop.
    const { container } = render(
      <MarkableText text={TEXT} cellOf={cellsOf({ 6: run, 7: run, 11: { m: 'ok', k: 's' } })} />,
    );

    expect(token(6)).toHaveAttribute('data-start');
    expect(token(6)).not.toHaveAttribute('data-end');
    expect(token(7)).toHaveAttribute('data-end');
    expect(token(7)).not.toHaveAttribute('data-start');

    const separators = [...container.querySelectorAll('span:not([data-i])')];
    const inside = separators.find((s) => s.textContent === ', ');
    expect(inside).toHaveAttribute('data-m', 'key');
    const fullStop = separators.find((s) => s.textContent === '.');
    expect(fullStop).not.toHaveAttribute('data-m');
  });

  it('never joins a run across a paragraph', () => {
    const run = { m: 'sel' as const, k: 'r' };
    render(<MarkableText text={TEXT} cellOf={cellsOf({ 11: run, 12: run })} />);
    expect(token(11)).toHaveAttribute('data-end');
    expect(token(12)).toHaveAttribute('data-start');
  });

  it('draws the ordinal on the first token of a run only, hidden from the reader of the word', () => {
    const run = { m: 'key' as const, k: 'r' };
    render(
      <MarkableText
        text={TEXT}
        cellOf={cellsOf({ 0: run, 1: run, 2: run })}
        numbers={(i) => (i === 0 ? 1 : 7)}
      />,
    );
    expect(token(0).querySelector('[aria-hidden="true"]')?.textContent).toBe('1');
    expect(token(1).querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('outlines the hot run', () => {
    render(
      <MarkableText
        text={TEXT}
        cellOf={cellsOf({ 3: { m: 'key', k: 'a' }, 9: { m: 'key', k: 'b' } })}
        hot="b"
      />,
    );
    expect(token(9)).toHaveAttribute('data-hot');
    expect(token(3)).not.toHaveAttribute('data-hot');
  });

  it('marks the key boundary of a near miss on the tokens and the separators between them', () => {
    const near = { m: 'near' as const, k: 'c', keyLine: true };
    const { container } = render(
      <MarkableText
        text={TEXT}
        cellOf={cellsOf({ 0: { m: 'miss', k: 'c', keyLine: true }, 1: near })}
      />,
    );
    expect(token(0)).toHaveAttribute('data-keyline');
    expect(token(1)).toHaveAttribute('data-keyline');
    expect(container.querySelector('span:not([data-i])[data-keyline]')?.textContent).toBe(' ');
  });
});

describe('MarkableText — gestures', () => {
  it('a click toggles one token', async () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} live onRange={onRange} />);
    await userEvent.click(screen.getByRole('button', { name: 'reiste' }));
    expect(onRange).toHaveBeenCalledTimes(1);
    expect(onRange).toHaveBeenCalledWith(3, 3);
  });

  it('a drag across tokens in a phrase question reports origin and end on release (AC-S3)', () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} live unit="phrase" onRange={onRange} />);

    fireEvent.pointerDown(token(1), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(token(2));
    fireEvent.pointerEnter(token(4));
    // The run under the finger is drawn while dragging.
    expect(token(3)).toHaveAttribute('data-m', 'sel');
    fireEvent.pointerUp(window);

    expect(onRange).toHaveBeenCalledWith(1, 4);
    expect(token(3)).not.toHaveAttribute('data-m');
  });

  it('a drag in a word question reports the origin alone (AC-M3)', () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} live unit="word" onRange={onRange} />);
    fireEvent.pointerDown(token(4), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(token(7));
    fireEvent.pointerUp(window);
    expect(onRange).toHaveBeenCalledWith(4, 4);
  });

  it('a drag stops at the paragraph it started in', () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} live unit="phrase" onRange={onRange} />);
    fireEvent.pointerDown(token(10), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(token(14));
    expect(token(12)).not.toHaveAttribute('data-m');
    fireEvent.pointerUp(window);
    expect(onRange).toHaveBeenCalledWith(10, 11);
  });

  it('a cancelled pointer — a scroll took it — marks nothing', () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} live unit="phrase" onRange={onRange} />);
    fireEvent.pointerDown(token(1), { button: 0, pointerId: 1 });
    fireEvent(window, new Event('pointercancel'));
    fireEvent.pointerUp(window);
    expect(onRange).not.toHaveBeenCalled();
  });

  it('a read-only passage ignores presses', () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} onRange={onRange} />);
    fireEvent.pointerDown(token(1), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(window);
    expect(onRange).not.toHaveBeenCalled();
  });
});

describe('MarkableText — keyboard (AC-X7)', () => {
  it('Enter and Space toggle the focused token', async () => {
    const onRange = vi.fn();
    render(<MarkableText text={TEXT} live onRange={onRange} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(token(0));
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onRange.mock.calls).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('Shift+Arrow resizes a marked token in a phrase question, and nothing else', () => {
    const onExtend = vi.fn();
    const { rerender } = render(
      <MarkableText
        text={TEXT}
        live
        unit="phrase"
        cellOf={cellsOf({ 2: { m: 'sel', k: 'a' } })}
        onExtend={onExtend}
      />,
    );
    fireEvent.keyDown(token(2), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(token(2), { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(token(3), { key: 'ArrowRight', shiftKey: true });
    expect(onExtend.mock.calls).toEqual([
      [2, 1],
      [2, -1],
    ]);

    rerender(
      <MarkableText
        text={TEXT}
        live
        unit="word"
        cellOf={cellsOf({ 2: { m: 'sel', k: 'a' } })}
        onExtend={onExtend}
      />,
    );
    fireEvent.keyDown(token(2), { key: 'ArrowRight', shiftKey: true });
    expect(onExtend).toHaveBeenCalledTimes(2);
  });
});
