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
let canCreate = true;
vi.mock('../hooks/use-create-course-flow', () => ({
  useCreateCourseFlow: () => ({ create, isCreating: false, canCreate }),
}));

const { QuickCreatePanel } = await import('./quick-create-panel');
const { useCreateCourseStore } = await import('../stores/create-course');

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QuickCreatePanel />
    </NextIntlClientProvider>,
  );
}

describe('QuickCreatePanel', () => {
  beforeEach(() => {
    useCreateCourseStore.getState().reset();
    canCreate = true;
    vi.clearAllMocks();
  });

  it('renders the title field, language/levels selects, and starter chips', () => {
    renderPanel();
    expect(screen.getByLabelText(/course title/i)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Start from' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Clone existing course' })).toBeDisabled();
  });

  it('picking a starter chip updates the store', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Start blank' }));
    expect(useCreateCourseStore.getState().starter).toBe('blank');
  });

  it('"Create & open editor" calls create()', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /create & open editor/i }));
    expect(create).toHaveBeenCalledOnce();
  });

  it('disables the create button when canCreate is false', () => {
    canCreate = false;
    renderPanel();
    expect(screen.getByRole('button', { name: /create & open editor/i })).toBeDisabled();
  });
});
