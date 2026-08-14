import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_FLOW, type Translate } from '@/lib/shared-kernel/translate';

import { TranslatePreview } from './translate-preview';
import { makeDoc, makeItem } from './test-doc';

function renderPreview(exercise: Translate = makeDoc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TranslatePreview exercise={exercise} />
    </NextIntlClientProvider>,
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
