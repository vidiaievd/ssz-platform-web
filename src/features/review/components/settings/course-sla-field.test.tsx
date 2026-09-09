import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { CourseSlaField } from './course-sla-field';

function renderField() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CourseSlaField containerId="course-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

function answer(settings: {
  respondWithinHours: number | null;
  inheritedHours: number | null;
  overridden: boolean;
}) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => settings });
}

describe('CourseSlaField', () => {
  it('shows the inherited number while the override is off, never an empty box', async () => {
    answer({ respondWithinHours: null, inheritedHours: 48, overridden: false });
    renderField();

    const field = await screen.findByLabelText('Response time in hours');
    expect(field).toHaveValue(48);
    expect(field).toBeDisabled();
    expect(screen.getByText('Inherited from the school: 48 h.')).toBeInTheDocument();
  });

  it('keeps the inherited number as the starting point when the override is switched on', async () => {
    answer({ respondWithinHours: null, inheritedHours: 48, overridden: false });
    renderField();

    await userEvent.click(await screen.findByRole('checkbox'));

    const field = screen.getByLabelText('Response time in hours');
    expect(field).toBeEnabled();
    expect(field).toHaveValue(48);
  });

  it('sends null to hand the promise back to the school', async () => {
    answer({ respondWithinHours: 24, inheritedHours: 48, overridden: true });
    renderField();

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/content/containers/course-1/review-settings',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ respondWithinHours: null }),
        }),
      );
    });
  });

  it('says so plainly where the school has promised nothing to inherit', async () => {
    answer({ respondWithinHours: null, inheritedHours: null, overridden: false });
    renderField();

    expect(
      await screen.findByText('The school has not set a response time yet.'),
    ).toBeInTheDocument();
  });
});
