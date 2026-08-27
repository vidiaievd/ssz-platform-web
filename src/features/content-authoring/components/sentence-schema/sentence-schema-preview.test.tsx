import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';
import { chunk, content, row } from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';

import { SentenceSchemaPreview } from './sentence-schema-preview';

function doc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaContent {
  return content({ settings: { ...DEFAULT_SETTINGS, shuffle: false }, ...overrides });
}

function renderPreview(exercise: SentenceSchemaContent = doc()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SentenceSchemaPreview exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

/** Play the whole sentence correctly, the way a student would: word, then field. */
async function solve(user: ReturnType<typeof userEvent.setup>) {
  for (const [word, field] of [
    ['I morgen', 'Forfelt'],
    ['skal', 'Finitt verbal'],
    ['jeg', 'Subjekt'],
    ['ikke', 'Setningsadverbial'],
    ['lese', 'Infinitt verbal'],
    ['boka', 'Objekt'],
  ] as const) {
    await user.click(screen.getByRole('button', { name: word }));
    await user.click(screen.getByRole('button', { name: `Place in ${field}` }));
  }
}

describe('SentenceSchemaPreview', () => {
  it('says there is nothing to show until a sentence is finished', () => {
    renderPreview(doc({ rows: [row({ chunks: [chunk('c1', 'skal')] })] }));

    expect(
      screen.getByText(
        "Finish a sentence — text written and every word placed — and the student's view appears here.",
      ),
    ).toBeInTheDocument();
  });

  it('renders the deliverable sentences only', () => {
    renderPreview(
      doc({ rows: [row(), row({ id: 'r2', text: 'Jeg leser', chunks: [chunk('d1', 'Jeg')] })] }),
    );

    expect(screen.getByLabelText('Sentence 1 of 1')).toBeInTheDocument();
  });

  it('hands the student a bank and no answer', () => {
    renderPreview();

    // The pieces, not where they go.
    expect(screen.getByRole('button', { name: 'I morgen' })).toBeInTheDocument();
    expect(screen.queryByText('I morgen skal jeg ikke lese boka')).not.toBeInTheDocument();
  });

  it('grades with the kernel — a correct board closes the sentence and shows the rule', async () => {
    const { user } = renderPreview();

    await solve(user);
    await user.click(screen.getByRole('button', { name: /^Check/ }));

    expect(screen.getByText('Det finitte verbet står på plass to.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('shows the correct schema on request, and does not call it solved', async () => {
    const { user } = renderPreview();

    await user.click(screen.getByRole('button', { name: 'Show the correct schema' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    expect(screen.getByText('0 solved · 1 shown')).toBeInTheDocument();
  });

  it('resets the board when a switch that changes what the student is handed moves', async () => {
    const { user, rerender } = renderPreview();

    await user.click(screen.getByRole('button', { name: 'I morgen' }));
    await user.click(screen.getByRole('button', { name: 'Place in Forfelt' }));
    expect(screen.getByRole('button', { name: /^Check \(1\/6\)/ })).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SentenceSchemaPreview
          exercise={doc({ settings: { ...DEFAULT_SETTINGS, shuffle: false, prefill: 'first' } })}
        />
      </NextIntlClientProvider>,
    );

    // Back to the board the student would start from — the pre-placed first chunk.
    expect(screen.getByRole('button', { name: /^Check \(1\/6\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take «I morgen» back' })).toBeInTheDocument();
  });

  it('leaves the bank alone while the author types — no reshuffle per keystroke', () => {
    const shuffled = doc({ settings: { ...DEFAULT_SETTINGS } });
    const { rerender } = renderPreview(shuffled);
    const before = screen
      .getAllByRole('button')
      .map((el) => el.textContent)
      .join('|');

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SentenceSchemaPreview exercise={{ ...shuffled, title: 'Ordstilling 2' }} />
      </NextIntlClientProvider>,
    );

    expect(
      screen
        .getAllByRole('button')
        .map((el) => el.textContent)
        .join('|'),
    ).toBe(before);
  });
});
