import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_FLOW, type Translate } from '@/lib/shared-kernel/translate';

import { TranslatePreview } from './translate-preview';
import { makeDoc, makeItem } from './test-doc';

// The preview renders the real runner body, and every sentence card now runs the
// listening layer's engine — which resolves a clip through media-service (plan 56
// phase 6). These tests mount no QueryClientProvider.
vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderPreview(exercise: Translate = makeDoc()) {
  render(
    // The preview renders the real runner body, whose sentence cards run the listening
    // layer's engine — two network questions behind a query client (plan 56 phase 6).
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TranslatePreview exercise={exercise} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('TranslatePreview', () => {
  it('shows the sentence the student reads', () => {
    renderPreview();

    expect(screen.getByText('Я живу в Тромсё три года.')).toBeInTheDocument();
  });

  /**
   * The invariant this column exists to keep visible: in this template the accepted
   * translation *is* the answer, so it never reaches a browser — not even the author's,
   * through the student's view.
   */
  it('carries no accepted translation into the student view', () => {
    renderPreview(makeDoc({ items: [makeItem({ refs: ['Jeg har bodd i Tromsø i tre år.'] })] }));

    expect(screen.queryByText(/Jeg har bodd/)).not.toBeInTheDocument();
  });

  it('shows the glosses only when the flow says to', () => {
    const withGloss = makeDoc({ items: [makeItem({ gloss: [{ w: 'уже', t: 'allerede' }] })] });

    renderPreview(withGloss);
    expect(screen.getByText(/allerede/)).toBeInTheDocument();
  });

  it('drops the glosses when the author has turned them off', () => {
    renderPreview(
      makeDoc({
        items: [makeItem({ gloss: [{ w: 'уже', t: 'allerede' }] })],
        flow: { ...DEFAULT_FLOW, gloss: false },
      }),
    );

    expect(screen.queryByText(/allerede/)).not.toBeInTheDocument();
  });

  it('asks for a sentence before it can show a screen', () => {
    renderPreview(makeDoc({ items: [] }));

    expect(screen.getByText("Write a sentence to see the student's screen.")).toBeInTheDocument();
  });
});
