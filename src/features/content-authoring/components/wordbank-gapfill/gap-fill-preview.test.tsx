import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import { GapFillPreview } from './gap-fill-preview';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: '',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }],
    distractors: ['bestilt'],
    feedback: { 's1#3': { fallback: 'Her mangler verbet.', why: '', pairs: {} } },
    updatedAt: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

function renderPreview(exercise = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GapFillPreview exercise={exercise} instructions="Fyll inn ordene." />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

describe('GapFillPreview', () => {
  it('renders the real runner body from the document being written (AC-B28)', () => {
    renderPreview();

    expect(screen.getByText('Fyll inn ordene.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bestille' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bestilt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G1: empty gap' })).toBeInTheDocument();
    // Never the answer in the sentence: the projection is the student's, masking and all.
    expect(screen.queryByText(/gjerne bestille en/)).not.toBeInTheDocument();
  });

  it('is playable, so the teacher can feel what they built', async () => {
    const { user } = renderPreview();

    await user.click(screen.getByRole('button', { name: 'bestille' }));

    expect(screen.getByRole('button', { name: 'G1: bestille' })).toBeInTheDocument();
  });

  it('says the one thing it cannot do', () => {
    renderPreview();

    expect(screen.getByText(/Checking happens for students/)).toBeInTheDocument();
  });

  it('waits for something to show rather than rendering an empty exercise', () => {
    renderPreview(doc({ sentences: [] }));

    expect(screen.getByText(/the student's view appears here/)).toBeInTheDocument();
  });
});
