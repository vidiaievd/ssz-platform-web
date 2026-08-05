import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReaderSidebarCourse, ReaderSidebarLevel, ReaderSidebarUnit } from '../types';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { ContentsSidebar } = await import('./contents-sidebar');

const course: ReaderSidebarCourse = {
  title: 'Norsk B1',
  flag: '🇳🇴',
  percentComplete: 34,
  itemsDone: 17,
  itemsTotal: 50,
};

const units: ReaderSidebarUnit[] = [
  {
    id: 'u1',
    position: 1,
    title: 'Hverdagsliv',
    status: 'done',
    href: '/student/courses/course-1/u1',
    sections: [],
  },
  {
    id: 'u2',
    position: 2,
    title: 'Arbeid og studier',
    status: 'active',
    href: '/student/courses/course-1/u2',
    sections: [
      {
        id: 's-read',
        label: 'Reinforce & read',
        items: [
          {
            id: 'text-1',
            kind: 'text',
            title: 'En vanlig arbeidsdag',
            durationLabel: '8 min',
            status: 'available',
            href: '/student/courses/course-1/u2/text-1',
          },
          {
            id: 'ex-1',
            kind: 'exercise',
            title: 'Blandet øving',
            durationLabel: '12 min',
            status: 'locked',
            href: '/student/courses/course-1/u2/ex-1',
          },
        ],
      },
    ],
  },
  {
    id: 'u3',
    position: 3,
    title: 'Meninger og fortellinger',
    status: 'locked',
    href: '/student/courses/course-1/u3',
    sections: [],
  },
];

const levels: ReaderSidebarLevel[] = [
  { id: 'l1', position: 1, title: 'Leksjon 1 — Hverdagsliv', active: false, units: [units[0]!] },
  {
    id: 'l2',
    position: 2,
    title: 'Leksjon 2 — Arbeidsliv',
    active: true,
    units: [units[1]!, units[2]!],
  },
];

function renderSidebar(props: Partial<React.ComponentProps<typeof ContentsSidebar>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ContentsSidebar
        course={course}
        units={units}
        activeItemId="text-1"
        collapsed={false}
        onToggleCollapse={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('ContentsSidebar', () => {
  it('renders course progress and the active unit expanded', () => {
    renderSidebar();

    expect(screen.getByText('Completed 34%')).toBeInTheDocument();
    expect(screen.getByText('17/50')).toBeInTheDocument();
    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
  });

  it('renders the active item as a link with the given href', () => {
    renderSidebar();

    const link = screen.getByRole('link', { name: /En vanlig arbeidsdag/ });
    expect(link).toHaveAttribute('href', '/student/courses/course-1/u2/text-1');
  });

  it('renders locked items as non-interactive, not as links', () => {
    renderSidebar();

    expect(screen.queryByRole('link', { name: /Blandet øving/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Blandet øving (Locked)')).toBeInTheDocument();
  });

  it('collapses to the 56px rail and calls onToggleCollapse', () => {
    const onToggleCollapse = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapse });

    expect(screen.queryByText('Contents')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show contents'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('collapses the active unit on click, hiding its sections', () => {
    renderSidebar();

    expect(screen.getByText('Reinforce & read')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Collapse sub-lesson'));
    expect(screen.queryByText('Reinforce & read')).not.toBeInTheDocument();
  });

  it('links every unlocked sub-lesson to its entry route, so units the reader has no contents for stay reachable', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /Hverdagsliv/ })).toHaveAttribute(
      'href',
      '/student/courses/course-1/u1',
    );
    // The open unit links to itself as well — its own title stays clickable.
    expect(screen.getByRole('link', { name: /Arbeid og studier/ })).toHaveAttribute(
      'href',
      '/student/courses/course-1/u2',
    );
  });

  it('leaves a locked sub-lesson unlinked', () => {
    renderSidebar();

    expect(
      screen.queryByRole('link', { name: /Meninger og fortellinger/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Meninger og fortellinger')).toBeInTheDocument();
  });

  describe('with Leksjon grouping', () => {
    it('expands only the level holding the open unit', () => {
      renderSidebar({ levels });

      // Both level headers are listed…
      expect(screen.getByRole('button', { name: /Leksjon 1/ })).toBeInTheDocument();
      // …but only the active level's units are rendered.
      expect(screen.getByText('Arbeid og studier')).toBeInTheDocument();
      expect(screen.queryByText('Hverdagsliv')).not.toBeInTheDocument();
    });

    it('shows per-level unit completion', () => {
      renderSidebar({ levels });

      expect(screen.getByRole('button', { name: /Leksjon 1/ })).toHaveTextContent('1/1');
      expect(screen.getByRole('button', { name: /Leksjon 2/ })).toHaveTextContent('0/2');
    });

    it('toggles a level open and closed on click', () => {
      renderSidebar({ levels });

      fireEvent.click(screen.getByRole('button', { name: /Leksjon 1/ }));
      expect(screen.getByText('Hverdagsliv')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Leksjon 2/ }));
      expect(screen.queryByText('Arbeid og studier')).not.toBeInTheDocument();
    });

    it('marks only the open sub-lesson as current, not every "active" one', () => {
      // Both u2 and u3 would read as unfinished under open gating; only the
      // one the reader is inside may be highlighted.
      const { container } = renderSidebar({ levels, activeUnitId: 'u2' });

      const current = container.querySelectorAll('[aria-current="true"]');
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent('Arbeid og studier');
    });

    it('falls back to the flat unit list when no levels are given', () => {
      renderSidebar({ levels: [] });

      expect(screen.getByText('Hverdagsliv')).toBeInTheDocument();
      expect(screen.getByText('Arbeid og studier')).toBeInTheDocument();
    });
  });
});
