import { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useScrollPositionStore } from '../stores/scroll-position-store';
import { useScrollRestoration } from './use-scroll-restoration';

afterEach(() => {
  useScrollPositionStore.setState({ positions: {} });
  window.localStorage.clear();
});

function Harness({
  persistKey,
  ready = true,
  scrollable = true,
}: {
  persistKey?: string;
  ready?: boolean;
  scrollable?: boolean;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  useScrollRestoration(anchorRef, persistKey, ready);
  return (
    <div data-testid="container" className={scrollable ? 'overflow-auto' : ''}>
      <div ref={anchorRef} data-testid="anchor" />
    </div>
  );
}

describe('useScrollRestoration', () => {
  it('restores the saved scrollTop of the nearest overflow-auto ancestor', () => {
    useScrollPositionStore.getState().setPosition('lesson-1:variant-1', 240);
    const { getByTestId } = render(<Harness persistKey="lesson-1:variant-1" />);

    expect(getByTestId('container').scrollTop).toBe(240);
  });

  it('does not restore before the content is ready', () => {
    useScrollPositionStore.getState().setPosition('lesson-1:variant-1', 240);
    const { getByTestId } = render(<Harness persistKey="lesson-1:variant-1" ready={false} />);

    expect(getByTestId('container').scrollTop).toBe(0);
  });

  it('does nothing when no scrollable ancestor exists', () => {
    useScrollPositionStore.getState().setPosition('lesson-1:variant-1', 240);
    const { getByTestId } = render(<Harness persistKey="lesson-1:variant-1" scrollable={false} />);

    expect(getByTestId('container').scrollTop).toBe(0);
  });

  it('persists the scroll position while scrolling', () => {
    const { getByTestId } = render(<Harness persistKey="lesson-1:variant-1" />);
    const container = getByTestId('container');
    container.scrollTop = 180;
    fireEvent.scroll(container);

    expect(useScrollPositionStore.getState().getPosition('lesson-1:variant-1')).toBe(180);
  });

  it('persists the final position on unmount', () => {
    const { getByTestId, unmount } = render(<Harness persistKey="lesson-1:variant-1" />);
    getByTestId('container').scrollTop = 90;
    unmount();

    expect(useScrollPositionStore.getState().getPosition('lesson-1:variant-1')).toBe(90);
  });
});
