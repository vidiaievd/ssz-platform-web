import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CELL_STATES } from '@/lib/shared-kernel/analytics';

import { HeatCell } from './heat-cell';

const cellOf = (container: HTMLElement) => container.querySelector('span > span') as HTMLElement;

describe('every state gets its own shape', () => {
  it.each(CELL_STATES)('renders %s distinguishably', (state) => {
    const { container } = render(
      <HeatCell cell={{ state, value: state === 'ok' || state === 'low' ? 70 : null }} />,
    );

    expect(cellOf(container).getAttribute('style')).toMatchSnapshot();
  });

  it('draws no two states alike', () => {
    const drawn = CELL_STATES.map((state) => {
      const { container } = render(
        <HeatCell cell={{ state, value: state === 'ok' || state === 'low' ? 70 : null }} />,
      );
      const cell = cellOf(container);
      return `${cell.getAttribute('style')}|${cell.textContent}`;
    });

    // `ok` and `low` are the two ends of one scale and share a drawing at the same value;
    // every kind of emptiness has to differ from every other and from both of them.
    expect(new Set(drawn).size).toBe(CELL_STATES.length - 1);
  });
});

describe('a measured zero is not an absence', () => {
  it('prints 0 for a zero and nothing for a cell nobody attempted', () => {
    const { container: zero } = render(<HeatCell cell={{ state: 'low', value: 0 }} />);
    const { container: untouched } = render(
      <HeatCell cell={{ state: 'notStarted', value: null }} />,
    );

    expect(cellOf(zero).textContent).toBe('0');
    expect(cellOf(untouched).textContent).toBe('');
    expect(cellOf(zero).getAttribute('style')).not.toBe(cellOf(untouched).getAttribute('style'));
  });

  it('fills a measured zero and leaves an unmeasured cell unfilled', () => {
    const { container: zero } = render(<HeatCell cell={{ state: 'low', value: 0 }} />);
    const { container: untouched } = render(
      <HeatCell cell={{ state: 'notStarted', value: null }} />,
    );

    expect(cellOf(zero).style.background).toContain('oklch');
    expect(cellOf(untouched).style.border).toContain('dashed');
  });

  it('says "no items" with a dash rather than a blank', () => {
    // A blank grey cell reads as a cell that failed to load; this one is a statement
    // about the course.
    const { container } = render(<HeatCell cell={{ state: 'noContent', value: null }} />);
    expect(cellOf(container).textContent).toBe('—');
  });
});

describe('as a control', () => {
  it('is a button only when it does something', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <HeatCell cell={{ state: 'ok', value: 80 }} onClick={onClick} tip="Anna · Unit 4" />,
    );
    expect(screen.getByRole('button')).toBeTruthy();

    rerender(<HeatCell cell={{ state: 'notDelivered', value: null }} tip="Unit 4 · not taught" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
