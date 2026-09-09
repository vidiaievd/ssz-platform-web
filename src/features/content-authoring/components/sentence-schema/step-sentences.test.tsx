import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE } from '@/lib/shared-kernel/sentence-schema';
import type { SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';
import { chunk, content, row } from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';

import { StepSentences } from './step-sentences';
import type { SentenceSchemaDocument } from './edits';

vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => `${Math.random().toString(36).slice(2, 10)}-0000-0000-0000-000000000000`,
});

function doc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaDocument {
  return {
    updatedAt: '2026-08-26T10:00:00.000Z',
    // Every builder document carries the audio layer, and one that has never had any
    // reads as switched off (plan 56 phase 6).
    audio: readAudioDraft({}, TEMPLATE_CODE),
    ...content(overrides),
  };
}

/** Drives the controlled step the way the shell does, so edits accumulate. */
function Harness({
  initial,
  onChange,
}: {
  initial: SentenceSchemaDocument;
  onChange?: (next: SentenceSchemaDocument) => void;
}) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepSentences
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: SentenceSchemaDocument = doc()) {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup(), onChange };
}

describe('StepSentences', () => {
  it('counts the sentences a student could actually be given', () => {
    renderStep(
      doc({
        rows: [
          row(),
          row({
            id: 'r2',
            text: 'Jeg leser',
            chunks: [chunk('d1', 'Jeg', 'n'), chunk('d2', 'leser')],
          }),
        ],
      }),
    );

    expect(screen.getByText('1 sentence ready to play')).toBeInTheDocument();
  });

  it('says on the card how many words are still outside the schema', () => {
    renderStep(
      doc({
        rows: [
          row({ chunks: [chunk('c1', 'I morgen', 'F'), chunk('c2', 'skal'), chunk('c3', 'jeg')] }),
        ],
      }),
    );

    expect(screen.getByText('2 words left')).toBeInTheDocument();
    // And on the step, not only in the gate.
    expect(screen.getByText('Sentence 1 has 2 words outside the schema.')).toBeInTheDocument();
  });

  it('marks a finished sentence complete', () => {
    renderStep();

    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('re-tokenizes on every keystroke and keeps the placements it can', async () => {
    const { user, onChange } = renderStep();

    await user.type(
      screen.getByLabelText('The sentence, as the student should end up with it'),
      '!',
    );

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.rows[0]!.text).toBe('I morgen skal jeg ikke lese boka!');
    // Everything but the word that changed is still placed.
    expect(latest.rows[0]!.chunks.filter((c) => c.field !== null)).toHaveLength(5);
  });

  it('joins two words into one element', async () => {
    const { user, onChange } = renderStep(
      doc({ rows: [row({ chunks: [chunk('c1', 'I', 'F'), chunk('c2', 'morgen')] })] }),
    );

    await user.click(screen.getByRole('button', { name: 'Join with the next word' }));

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.rows[0]!.chunks).toEqual([
      expect.objectContaining({ text: 'I morgen', field: 'F' }),
    ]);
  });

  it('places a chunk by selecting it and then pressing a field — no pointer needed', async () => {
    const { user, onChange } = renderStep(doc({ rows: [row({ chunks: [chunk('c1', 'skal')] })] }));

    await user.click(screen.getByRole('button', { name: 'skal', pressed: false }));
    await user.click(screen.getByRole('button', { name: 'Place in Finitt verbal' }));

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.rows[0]!.chunks[0]!.field).toBe('v');
  });

  it('offers the alternative fields of a placed chunk, never its own', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Select «I morgen»' }));

    const strip = screen.getByText('«I morgen» may also be correct in:').closest('div')!;
    expect(within(strip).queryByRole('button', { name: /Forfelt/ })).not.toBeInTheDocument();
    expect(
      within(strip).getByRole('button', { name: 'a · Setningsadverbial' }),
    ).toBeInTheDocument();
  });

  it('warns that changing the clause type clears the sentence, before it is changed', () => {
    renderStep(doc({ clauses: ['main', 'sub'] }));

    expect(
      screen.getByText(
        'Changing the clause type clears every word placed in this sentence — the fields belong to the type.',
      ),
    ).toBeInTheDocument();
  });

  it('adds a distractor on Enter and never lets it near the chunks', async () => {
    const { user, onChange } = renderStep();

    await user.type(
      screen.getByLabelText('Extra pieces in the word bank (optional)'),
      'boken{Enter}',
    );

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.rows[0]!.extras.map((e) => e.text)).toEqual(['boken']);
    expect(latest.rows[0]!.chunks.map((c) => c.text)).not.toContain('boken');
  });

  it('keeps the source sentence as a prompt and out of the chunks', async () => {
    const { user, onChange } = renderStep();

    await user.type(screen.getByLabelText('Sentence to rewrite (optional)'), 'Jeg');

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.rows[0]!.source).toBe('Jeg');
    expect(latest.rows[0]!.chunks).toHaveLength(6);
  });

  it('applies a bulk paste, dropping the blank card it landed on', async () => {
    const { user, onChange } = renderStep(doc({ rows: [row({ text: '', chunks: [] })] }));

    await user.click(screen.getByRole('button', { name: 'Paste several' }));
    await user.type(screen.getByLabelText('Paste several sentences'), 'skal | jeg');
    await user.click(screen.getByRole('button', { name: 'Add 1 sentence' }));

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.rows).toHaveLength(1);
    expect(latest.rows[0]!.chunks.map((c) => [c.text, c.field])).toEqual([
      ['skal', 'F'],
      ['jeg', 'v'],
    ]);
  });

  it('will not delete the last sentence', () => {
    renderStep();

    expect(screen.getByRole('button', { name: 'Delete sentence' })).toBeDisabled();
  });
});
