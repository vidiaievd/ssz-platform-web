import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';
import { content, row } from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';

import { StepFeedback } from './step-feedback';
import type { SentenceSchemaDocument } from './edits';

function doc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaDocument {
  return { updatedAt: '2026-08-26T10:00:00.000Z', ...content(overrides) };
}

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
      <StepFeedback
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

describe('StepFeedback', () => {
  it('counts the sentences that have a rule written', () => {
    renderStep(doc({ rows: [row(), row({ id: 'r2', text: 'Jeg leser', why: '' })] }));

    expect(screen.getByText('1', { selector: 'p' })).toHaveTextContent('1 / 2');
  });

  it('says on the card that a sentence has no rule — the blocker, where it is fixed', () => {
    renderStep(doc({ rows: [row({ why: '' })] }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Needed before you can assign this exercise.',
    );
  });

  it('writes the rule for the sentence it was typed under', async () => {
    const { user, onChange } = renderStep(doc({ rows: [row({ why: '' })] }));

    await user.type(screen.getByLabelText('Rule for this sentence'), 'V2');

    expect((onChange.mock.lastCall![0] as SentenceSchemaDocument).rows[0]!.why).toBe('V2');
  });

  it('keeps the chunk notes folded away until they are asked for', async () => {
    const { user } = renderStep();

    expect(
      screen.queryByPlaceholderText('Shown when this chunk lands in the wrong field'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Chunk notes/ }));

    expect(
      screen.getAllByPlaceholderText('Shown when this chunk lands in the wrong field'),
    ).toHaveLength(6);
  });

  it('writes a note against the chunk it belongs to', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('button', { name: /Chunk notes/ }));
    await user.type(
      screen.getAllByPlaceholderText('Shown when this chunk lands in the wrong field')[0]!,
      'V2',
    );

    expect((onChange.mock.lastCall![0] as SentenceSchemaDocument).rows[0]!.fb).toEqual({
      c1: 'V2',
    });
  });

  it('counts only the notes that say something', () => {
    renderStep(doc({ rows: [row({ fb: { c1: 'Bare ett ledd.', c2: '  ' } })] }));

    expect(screen.getByText(/1 chunk-level note$/)).toBeInTheDocument();
  });

  it('names an empty sentence rather than showing a blank row', () => {
    renderStep(doc({ rows: [row({ text: '', chunks: [] })] }));

    expect(screen.getByText('empty sentence')).toBeInTheDocument();
  });

  it('tells the author where the chunks come from when there are none yet', async () => {
    const { user } = renderStep(doc({ rows: [row({ text: '', chunks: [] })] }));

    await user.click(screen.getByRole('button', { name: /Chunk notes/ }));

    expect(
      screen.getByText('Place the words in step 2 and the chunks appear here.'),
    ).toBeInTheDocument();
  });
});
