import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

const setThemeMock = vi.fn();
let resolvedTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme: setThemeMock }),
}));

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

const { ReaderTopBar } = await import('./reader-top-bar');

function renderTopBar(props: Partial<React.ComponentProps<typeof ReaderTopBar>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ReaderTopBar
        courseHref="/student/courses/course-1"
        unitPosition={4}
        itemKind="text"
        itemTitle="En vanlig arbeidsdag"
        avatarName="Alex Rivera"
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('ReaderTopBar', () => {
  it('renders the breadcrumb with the leksjon, sub-lesson and current item', () => {
    renderTopBar({ levelTitle: 'Leksjon 1 — Arbeidsliv', unitTitle: '1A — Bartek søker ny jobb' });

    expect(screen.getByText('Leksjon 1 — Arbeidsliv')).toBeInTheDocument();
    expect(screen.getByText('1A — Bartek søker ny jobb')).toBeInTheDocument();
    expect(screen.getByText('Reading · En vanlig arbeidsdag')).toBeInTheDocument();
  });

  it('falls back to the unit position when the course has no grouping', () => {
    renderTopBar();

    expect(screen.getByText('Unit 4')).toBeInTheDocument();
    expect(screen.getByText('Reading · En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Course/ })).toHaveAttribute(
      'href',
      '/student/courses/course-1',
    );
  });

  it('toggles theme to dark when currently light', () => {
    resolvedTheme = 'light';
    renderTopBar();

    fireEvent.click(screen.getByLabelText('Switch to dark theme'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('toggles theme to light when currently dark', () => {
    resolvedTheme = 'dark';
    renderTopBar();

    fireEvent.click(screen.getByLabelText('Switch to light theme'));
    expect(setThemeMock).toHaveBeenCalledWith('light');
  });
});
