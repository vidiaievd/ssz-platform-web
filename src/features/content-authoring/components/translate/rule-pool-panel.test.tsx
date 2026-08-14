import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ExerciseRuleLink } from '@/features/content/types';

import { RulePoolPanel } from './rule-pool-panel';

const RULES = [
  { id: 'rule-1', title: 'Perfektum', moduleTitle: 'Grammatikk' },
  { id: 'rule-2', title: 'Leddstilling', moduleTitle: 'Grammatikk' },
];

const LINK: ExerciseRuleLink = {
  ruleId: 'rule-1',
  title: 'Perfektum',
  topic: 'VERBS',
  subtopic: 'Presens perfektum',
  difficultyLevel: 'B1',
  weight: 1,
  position: 0,
};

const fetchMock = vi.fn();

function renderPanel(links: ExerciseRuleLink[] = []) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'GET') {
      return Promise.resolve(new Response(JSON.stringify(links), { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <RulePoolPanel exerciseId="ex-1" rules={RULES} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup() };
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RulePoolPanel', () => {
  /** The difference the panel exists to explain, in words rather than in a tooltip. */
  it('says what an unattached exercise means for the student', async () => {
    renderPanel();

    expect(
      await screen.findByText(
        'Not attached to a rule yet — this exercise is asked once, in its lesson.',
      ),
    ).toBeInTheDocument();
  });

  it('writes the attachment to the rule’s pool, not into the exercise document', async () => {
    const { user } = renderPanel();
    await screen.findByRole('button', { name: /Perfektum/ });

    await user.click(screen.getByRole('button', { name: /Perfektum/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/content/grammar-rules/rule-1/pool',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ exerciseId: 'ex-1' }) }),
      ),
    );
  });

  it('offers only the rules this exercise is not already practised by', async () => {
    renderPanel([LINK]);
    // The attached row, which is what tells the list which rules to drop.
    await screen.findByText('Presens perfektum · B1');

    expect(screen.getByRole('button', { name: /Leddstilling/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Perfektum$/ })).not.toBeInTheDocument();
  });

  it('changes how often the queue picks the exercise for one rule', async () => {
    const { user } = renderPanel([LINK]);
    const row = (await screen.findByText('Presens perfektum · B1')).closest('li')!;

    await user.click(within(row).getByRole('radio', { name: 'Often' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/content/grammar-rules/rule-1/pool/ex-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ weight: 2 }) }),
      ),
    );
  });

  it('detaches the exercise from a rule', async () => {
    const { user } = renderPanel([LINK]);

    await user.click(await screen.findByRole('button', { name: 'Detach from «Perfektum»' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/content/grammar-rules/rule-1/pool/ex-1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });
});
