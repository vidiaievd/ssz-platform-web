import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { AiFirstPanel } from './ai-first-panel';

function renderPanel(props: Partial<React.ComponentProps<typeof AiFirstPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        <AiFirstPanel exerciseId="ex-1" attemptId="att-1" templateCode="writing_task" {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const REVIEW = {
  outcome: 'approved',
  items: [],
  summary: 'Fin tekst.',
  marks: null,
  reviewedAt: '2026-11-27T10:01:00.000Z',
  disputedAt: null,
};

describe('AiFirstPanel (OQ-110)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says the model reads the work first while its verdict is coming', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent(/A language model reads your work first/);
  });

  it('shows the provisional verdict, when it counts, and the remarks without a dispute', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(REVIEW), { status: 200 }))),
    );
    renderPanel({
      initial: {
        outcome: 'approved',
        comment: 'Fin tekst.',
        at: '2026-11-27T10:01:00.000Z',
        countsAt: '2026-11-30T10:00:00.000Z',
      },
    });

    expect(screen.getByText('Preliminary AI assessment: accepted.')).toBeInTheDocument();
    expect(screen.getByText(/if there’s no answer by .*30.*, this one counts/)).toBeInTheDocument();
    expect(await screen.findByText('Fin tekst.')).toBeInTheDocument();
    expect(screen.getByText('Checked by AI, not a teacher')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'This review is wrong' })).not.toBeInTheDocument();
  });
});
