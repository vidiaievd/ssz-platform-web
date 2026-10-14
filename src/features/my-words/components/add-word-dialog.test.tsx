import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { AddWordDialog } from './add-word-dialog';

const source = {
  targetLanguage: 'nb',
  variantId: 'variant-1',
  paragraphIndex: 2,
  charStart: null,
  contextSentence: 'Plutselig stopper han opp.',
};

const word = (overrides: Record<string, unknown> = {}) => ({
  entryId: 'e1',
  vocabularyItemId: 'item-1',
  targetLanguage: 'nb',
  word: 'plutselig',
  surfaceForm: 'Plutselig',
  partOfSpeech: null,
  translation: null,
  status: 'pending',
  ownWord: true,
  contextSentence: null,
  source: null,
  createdAt: '2026-10-14T00:00:00.000Z',
  ...overrides,
});

/** Routes the dialog's fetches: the lookup answer is per test, the rest succeed. */
function mockFetch(lookup: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const json = url.startsWith('/api/personal-vocabulary/lookup')
        ? lookup
        : url === '/api/personal-vocabulary'
          ? { word: word(), created: true }
          : {};
      return new Response(JSON.stringify(json), { status: 200 });
    }),
  );
  return calls;
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AddWordDialog surfaceForm="Plutselig" source={source} onClose={() => undefined} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('AddWordDialog', () => {
  it('shows the course translation and sends none of its own', async () => {
    const calls = mockFetch({
      surfaceForm: 'Plutselig',
      entry: null,
      catalog: { word: 'plutselig', partOfSpeech: 'adjective', translation: 'suddenly' },
    });
    renderDialog();

    expect(await screen.findByText('suddenly')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to my words' }));

    await screen.findByText('Added');
    const post = calls.find((c) => c.url === '/api/personal-vocabulary');
    expect(post?.body).toEqual({
      targetLanguage: 'nb',
      translationLanguage: 'en',
      surfaceForm: 'Plutselig',
      contextSentence: 'Plutselig stopper han opp.',
      sourceVariantId: 'variant-1',
      sourceParagraph: 2,
    });
  });

  it('sends the student’s own translation for an unknown word', async () => {
    const calls = mockFetch({ surfaceForm: 'Plutselig', entry: null, catalog: null });
    renderDialog();

    const input = await screen.findByPlaceholderText('Your translation — or add it later');
    fireEvent.change(input, { target: { value: ' suddenly ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to my words' }));

    await waitFor(() =>
      expect(calls.find((c) => c.url === '/api/personal-vocabulary')?.body).toMatchObject({
        translation: 'suddenly',
      }),
    );
  });

  it('a word already added offers no second add', async () => {
    mockFetch({ surfaceForm: 'Plutselig', entry: word(), catalog: null });
    renderDialog();

    expect(await screen.findByText('Already in your words')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to my words' })).toBeNull();
  });
});
