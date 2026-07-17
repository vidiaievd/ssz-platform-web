import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReaderSidebarCourse, ReaderSidebarUnit } from '../types';

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
  { id: 'u1', position: 1, title: 'Hverdagsliv', status: 'done', sections: [] },
  {
    id: 'u2',
    position: 2,
    title: 'Arbeid og studier',
    status: 'active',
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
  { id: 'u3', position: 3, title: 'Meninger og fortellinger', status: 'locked', sections: [] },
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
    fireEvent.click(screen.getByRole('button', { name: /Arbeid og studier/ }));
    expect(screen.queryByText('Reinforce & read')).not.toBeInTheDocument();
  });
});
