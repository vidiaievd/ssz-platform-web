import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

let flowParam: string | null = null;
vi.mock('next/navigation', () => ({
  useParams: () => ({ schoolSlug: 'demo-school' }),
  useSearchParams: () => ({ get: (key: string) => (key === 'flow' ? flowParam : null) }),
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

vi.mock('./create-course-wizard', () => ({
  CreateCourseWizard: () => <div data-testid="wizard-flow" />,
}));
vi.mock('./quick-create-panel', () => ({
  QuickCreatePanel: () => <div data-testid="quick-flow" />,
}));

const { CreateCoursePage } = await import('./create-course-page');
const { useCreateCourseStore } = await import('../stores/create-course');

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CreateCoursePage />
    </NextIntlClientProvider>,
  );
}

describe('CreateCoursePage', () => {
  beforeEach(() => {
    useCreateCourseStore.getState().reset();
    flowParam = null;
    vi.clearAllMocks();
  });

  it('defaults to the guided wizard', () => {
    renderPage();
    expect(screen.getByTestId('wizard-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-flow')).not.toBeInTheDocument();
  });

  it('the Segmented toggle switches to quick-create', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Quick create' }));
    expect(screen.getByTestId('quick-flow')).toBeInTheDocument();
  });

  it('honors ?flow=quick on load', () => {
    flowParam = 'quick';
    renderPage();
    expect(screen.getByTestId('quick-flow')).toBeInTheDocument();
  });
});
