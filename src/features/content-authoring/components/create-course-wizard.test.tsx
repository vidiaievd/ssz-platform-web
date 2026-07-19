import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('next/navigation', () => ({
  useParams: () => ({ schoolSlug: 'demo-school' }),
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

const create = vi.fn();
vi.mock('../hooks/use-create-course-flow', () => ({
  useCreateCourseFlow: () => ({ create, isCreating: false, canCreate: true }),
}));

const { CreateCourseWizard } = await import('./create-course-wizard');
const { useCreateCourseStore } = await import('../stores/create-course');

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CreateCourseWizard />
    </NextIntlClientProvider>,
  );
}

describe('CreateCourseWizard', () => {
  beforeEach(() => {
    useCreateCourseStore.getState().reset();
    vi.clearAllMocks();
  });

  it('starts on the Basics step', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: 'Tell us about the course' })).toBeInTheDocument();
  });

  it('Continue advances to Levels, then Starter', () => {
    renderWizard();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: 'How is it structured?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: 'How do you want to start?' })).toBeInTheDocument();
  });

  it('Back returns to the previous step', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: 'Tell us about the course' })).toBeInTheDocument();
  });

  it('the last step calls create() via "Create course" instead of advancing', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.click(screen.getByRole('button', { name: /create course/i }));
    expect(create).toHaveBeenCalledOnce();
  });
});
