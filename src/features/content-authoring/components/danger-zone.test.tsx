import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('next/navigation', () => ({ useParams: () => ({ schoolSlug: 'my-school' }) }));
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { DangerZone } = await import('./danger-zone');

const ENROLLED = 12;

function mockFetch() {
  return vi.fn((url: string) => {
    if (url.endsWith('/enrollment-count')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: ENROLLED }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function renderZone() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DangerZone
          containerId="course-1"
          containerTitle="Norwegian A2"
          state="published"
          role="owner"
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('DangerZone — unpublishing a live course', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch());
  });

  it('states the consequence: students lose access, authors keep it', async () => {
    // The old copy promised a "Course paused" banner and continued enrolment.
    // Neither exists: the backend nulls the published pointer and the student
    // reader then returns nothing at all.
    renderZone();

    fireEvent.click(screen.getByRole('button', { name: /Unpublish/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Students lose access immediately');
    expect(dialog).toHaveTextContent("Only you and your school's admins can open the course");
    expect(dialog).not.toHaveTextContent('Course paused');
  });

  it('names how many students that is', async () => {
    renderZone();

    fireEvent.click(screen.getByRole('button', { name: /Unpublish/ }));

    await waitFor(() =>
      expect(
        screen.getByText('12 enrolled students lose access the moment you confirm.'),
      ).toBeInTheDocument(),
    );
  });

  it('unpublishes only once confirmed', async () => {
    renderZone();

    fireEvent.click(screen.getByRole('button', { name: /Unpublish/ }));
    await screen.findByRole('alertdialog');
    expect(fetch).not.toHaveBeenCalledWith(
      '/api/content/containers/course-1/unpublish',
      expect.anything(),
    );

    // Inside the dialog: the trigger behind it is inert while it is open.
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/content/containers/course-1/unpublish', {
        method: 'POST',
      }),
    );
  });
});
