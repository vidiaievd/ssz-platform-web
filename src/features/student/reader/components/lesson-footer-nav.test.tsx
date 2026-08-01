import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReaderSidebarItem, ReaderSidebarUnit } from '../types';

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

const { LessonFooterNav } = await import('./lesson-footer-nav');

const items: ReaderSidebarItem[] = [
  { id: 'i1', kind: 'vocab', title: 'Yrker og oppgaver', durationLabel: '7 min', status: 'completed', href: '/i1' },
  { id: 'i2', kind: 'text', title: 'En vanlig arbeidsdag', durationLabel: '8 min', status: 'in_progress', href: '/i2' },
  { id: 'i3', kind: 'video', title: 'Intervju på jobben', durationLabel: '6 min', status: 'available', href: '/i3' },
  { id: 'i4', kind: 'exercise', title: 'Blandet øving', durationLabel: '12 min', status: 'locked', href: '/i4' },
];

const nextUnit: ReaderSidebarUnit = {
  id: 'u3',
  position: 3,
  title: 'Meninger og fortellinger',
  status: 'active',
  href: '/student/courses/course-1/u3',
  sections: [],
};

function renderNav(props: Partial<React.ComponentProps<typeof LessonFooterNav>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LessonFooterNav items={items} activeItemId="i2" {...props} />
    </NextIntlClientProvider>,
  );
}

describe('LessonFooterNav', () => {
  it('renders prev and next links around the active item', () => {
    renderNav();

    const prevLink = screen.getByRole('link', { name: /Yrker og oppgaver/ });
    expect(prevLink).toHaveAttribute('href', '/i1');

    const nextLink = screen.getByRole('link', { name: /Intervju på jobben/ });
    expect(nextLink).toHaveAttribute('href', '/i3');
    expect(screen.getByText('Next · Video')).toBeInTheDocument();
  });

  it('calls onNext when the next link is activated', () => {
    const onNext = vi.fn();
    renderNav({ onNext });

    fireEvent.click(screen.getByRole('link', { name: /Intervju på jobben/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders a locked, non-interactive guard when the next item is locked', () => {
    renderNav({ activeItemId: 'i3' });

    expect(screen.getByText('Next unlocks after this')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Blandet øving/ })).not.toBeInTheDocument();
  });

  it('renders no previous link for the first item', () => {
    renderNav({ activeItemId: 'i1' });

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });

  it('renders no next control for the last item when no sub-lesson follows', () => {
    renderNav({ activeItemId: 'i4' });

    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
  });

  it('hands over to the next sub-lesson on the last item', () => {
    renderNav({ activeItemId: 'i4', nextUnit });

    const link = screen.getByRole('link', { name: /Meninger og fortellinger/ });
    expect(link).toHaveAttribute('href', '/student/courses/course-1/u3');
    expect(screen.getByText('Next sub-lesson')).toBeInTheDocument();
  });

  it('marks the last item complete when handing over to the next sub-lesson', () => {
    const onNext = vi.fn();
    renderNav({ activeItemId: 'i4', nextUnit, onNext });

    fireEvent.click(screen.getByRole('link', { name: /Meninger og fortellinger/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('keeps the in-unit next item ahead of the next sub-lesson', () => {
    renderNav({ nextUnit });

    expect(screen.getByRole('link', { name: /Intervju på jobben/ })).toBeInTheDocument();
    expect(screen.queryByText('Next sub-lesson')).not.toBeInTheDocument();
  });

  it('does not link a locked next sub-lesson', () => {
    renderNav({ activeItemId: 'i4', nextUnit: { ...nextUnit, status: 'locked' } });

    expect(
      screen.queryByRole('link', { name: /Meninger og fortellinger/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Next unlocks after this')).toBeInTheDocument();
  });
});
