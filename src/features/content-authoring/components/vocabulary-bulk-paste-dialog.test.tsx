import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('../actions/vocabulary', () => ({
  bulkCreateVocabularyItemsAction: vi.fn(),
}));

const { VocabularyBulkPasteDialog } = await import('./vocabulary-bulk-paste-dialog');
const { bulkCreateVocabularyItemsAction } = await import('../actions/vocabulary');

function renderDialog() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <VocabularyBulkPasteDialog listId="list-1" containerId="container-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(bulkCreateVocabularyItemsAction).mockReset();
  vi.mocked(bulkCreateVocabularyItemsAction).mockResolvedValue({
    ok: true,
    value: { created: 2 },
  } as never);
});

describe('VocabularyBulkPasteDialog', () => {
  it('parses pasted rows, shows a live count, and submits them on confirm', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Bulk paste' }));

    const textarea = await screen.findByPlaceholderText(/sykkel/);
    fireEvent.change(textarea, { target: { value: 'sykkel\tbicycle\tnoun\nsykle\tto cycle' } });

    expect(await screen.findByText('2 words detected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add 2 words/ }));

    await waitFor(() => {
      expect(bulkCreateVocabularyItemsAction).toHaveBeenCalledWith(
        'list-1',
        'container-1',
        [
          { lemma: 'sykkel', translation: 'bicycle', partOfSpeech: 'noun' },
          { lemma: 'sykle', translation: 'to cycle', partOfSpeech: undefined },
        ],
        'en',
      );
    });
  });

  it('disables submit until at least one valid row is parsed', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk paste' }));

    expect(await screen.findByRole('button', { name: /Add words/ })).toBeDisabled();
  });
});
