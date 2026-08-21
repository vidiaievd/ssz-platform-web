import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TopbarPortal, TopbarSlot, TopbarSlotProvider } from './topbar-slot';

function renderBar(children?: React.ReactNode) {
  return render(
    <TopbarSlotProvider>
      <header>
        <TopbarSlot fallback={<span>Search…</span>} />
      </header>
      <main>{children}</main>
    </TopbarSlotProvider>,
  );
}

describe('TopbarSlot', () => {
  it('shows the fallback while no page has anything to put there', () => {
    renderBar();

    expect(screen.getByText('Search…')).toBeInTheDocument();
  });

  it('lets a page render into the bar, and takes the fallback away', () => {
    renderBar(
      <TopbarPortal>
        <nav aria-label="Breadcrumb">Courses / 1A</nav>
      </TopbarPortal>,
    );

    const bar = screen.getByRole('banner');
    expect(bar).toContainElement(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(screen.queryByText('Search…')).not.toBeInTheDocument();
  });

  it('gives the bar back when the page leaves', () => {
    const { rerender } = renderBar(
      <TopbarPortal>
        <span>Courses / 1A</span>
      </TopbarPortal>,
    );

    rerender(
      <TopbarSlotProvider>
        <header>
          <TopbarSlot fallback={<span>Search…</span>} />
        </header>
        <main />
      </TopbarSlotProvider>,
    );

    expect(screen.getByText('Search…')).toBeInTheDocument();
  });
});
