import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyForm } from '@/features/content/types';

import { WordForms } from './word-forms';

const FORMS: VocabularyForm[] = [
  { label: 'Ubestemt entall', value: 'en sykepleier' },
  { label: 'Bestemt entall', value: 'sykepleieren' },
  { label: 'Ubestemt flertall', value: 'sykepleiere' },
];

function renderForms(props: Partial<React.ComponentProps<typeof WordForms>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordForms forms={FORMS} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('WordForms', () => {
  it('starts collapsed and reveals the forms on click', () => {
    renderForms();

    const toggle = screen.getByRole('button', { name: /all forms/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('sykepleieren')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('sykepleieren')).toBeInTheDocument();
    expect(screen.getByText('Bestemt entall')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText('sykepleieren')).not.toBeInTheDocument();
  });

  it('opens expanded when defaultOpen is set', () => {
    renderForms({ defaultOpen: true });

    expect(screen.getByRole('button', { name: /all forms/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('en sykepleier')).toBeInTheDocument();
  });

  it('highlights the form met in the text, case-insensitively', () => {
    renderForms({ defaultOpen: true, highlightValue: 'Sykepleieren' });

    const row = screen.getByText('sykepleieren').closest('[data-highlighted]');
    expect(row).not.toBeNull();
    expect(screen.getByText('en sykepleier').closest('[data-highlighted]')).toBeNull();
  });

  it('renders nothing when the item has no forms', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WordForms forms={[]} />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
