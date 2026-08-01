// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cn } from '@/lib/utils';

import { ReaderRailProvider, ReaderRailSlot, useReaderRailHost, useReaderRailVisible } from './reader-rail';

/** Drives the `xl` media query the rail is gated on. */
function setViewportWide(wide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: wide,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** The shell's arrangement, reduced to the parts the rail contract depends on. */
function Shell({ children }: { children?: React.ReactNode }) {
  // Destructured for the same reason the shell does it — see useReaderRailHost.
  const { value, setContainer, occupied } = useReaderRailHost();
  return (
    <ReaderRailProvider value={value}>
      <div>{children}</div>
      <aside
        data-testid="rail"
        ref={setContainer}
        className={cn(occupied ? 'block w-80' : 'hidden w-0')}
      />
    </ReaderRailProvider>
  );
}

function VisibilityProbe() {
  return <span data-testid="visible">{String(useReaderRailVisible())}</span>;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('ReaderRail', () => {
  it('leaves the column without width when no page offers rail content', () => {
    setViewportWide(true);
    render(<Shell />);

    expect(screen.getByTestId('rail').className).toContain('hidden');
  });

  it('gives the column width once a page fills it', () => {
    setViewportWide(true);
    render(
      <Shell>
        <ReaderRailSlot>
          <p>Lyd</p>
        </ReaderRailSlot>
      </Shell>,
    );

    expect(screen.getByTestId('rail').className).toContain('w-80');
    expect(screen.getByText('Lyd')).toBeInTheDocument();
  });

  it('portals the content into the rail, not into the article', () => {
    setViewportWide(true);
    render(
      <Shell>
        <ReaderRailSlot>
          <p>Lyd</p>
        </ReaderRailSlot>
      </Shell>,
    );

    expect(screen.getByTestId('rail')).toContainElement(screen.getByText('Lyd'));
  });

  it('renders nothing and keeps the column collapsed on a narrow viewport', () => {
    setViewportWide(false);
    render(
      <Shell>
        <ReaderRailSlot>
          <p>Lyd</p>
        </ReaderRailSlot>
      </Shell>,
    );

    expect(screen.queryByText('Lyd')).not.toBeInTheDocument();
    expect(screen.getByTestId('rail').className).toContain('hidden');
  });

  it('tells a page whether the rail is on screen, so it can fall back inline', () => {
    setViewportWide(false);
    render(
      <Shell>
        <VisibilityProbe />
      </Shell>,
    );

    expect(screen.getByTestId('visible')).toHaveTextContent('false');
  });

  it('releases the column when the page stops offering content', () => {
    setViewportWide(true);
    const { rerender } = render(
      <Shell>
        <ReaderRailSlot>
          <p>Lyd</p>
        </ReaderRailSlot>
      </Shell>,
    );
    expect(screen.getByTestId('rail').className).toContain('w-80');

    rerender(<Shell />);

    expect(screen.getByTestId('rail').className).toContain('hidden');
  });
});
