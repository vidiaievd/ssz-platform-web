import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import {
  SentenceSchemaBody,
  type SentenceSchemaContent,
  type SchemaPlacements,
} from './sentence-schema-body';

const messages = {
  ExerciseRunner: {
    sentenceSchema: {
      defaultInstruction: 'Place each word in the right field',
      bankLabel: 'Words',
      bankEmpty: 'All words placed',
      fieldDropLabel: 'Place in {field}',
    },
  },
};

const CONTENT: SentenceSchemaContent = {
  sentence: 'Lars har likt Lotte',
  fields: [
    { id: 'f1', label: 'Forfelt' },
    { id: 'f2', label: 'Verbal' },
  ],
  tokens: [
    { id: 't1', text: 'Lars' },
    { id: 't2', text: 'har' },
  ],
};
const ACCENT = 'var(--ssz-color-primary-500)';

function Harness({ onAnswerChange }: { onAnswerChange?: (canSubmit: boolean) => void }) {
  const [value, setValue] = useState<SchemaPlacements>({});
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <SentenceSchemaBody
        content={CONTENT}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange ?? (() => {})}
        phase="answering"
        ok={null}
        mode="practice"
        accent={ACCENT}
      />
    </NextIntlClientProvider>
  );
}

describe('SentenceSchemaBody', () => {
  it('renders the sentence, field labels and token bank', () => {
    render(<Harness />);
    expect(screen.getByText('Lars har likt Lotte')).toBeInTheDocument();
    expect(screen.getByText('Forfelt')).toBeInTheDocument();
    expect(screen.getByText('Verbal')).toBeInTheDocument();
    // Tokens start in the bank.
    expect(screen.getByRole('button', { name: 'Lars' })).toBeInTheDocument();
  });

  it('places an armed token into a field on tap and reports progress', () => {
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);

    // Arm "Lars" then tap the Forfelt drop zone.
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(screen.getByLabelText('Place in Forfelt'));
    // Arm "har" then tap the Verbal drop zone → all tokens placed.
    fireEvent.click(screen.getByRole('button', { name: 'har' }));
    fireEvent.click(screen.getByLabelText('Place in Verbal'));

    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('All words placed')).toBeInTheDocument();
  });

  it('returns a placed token to the bank when tapped', () => {
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lars' }));
    fireEvent.click(screen.getByLabelText('Place in Forfelt'));
    // "Lars" is now placed (a role=button chip inside the field). Tap to remove.
    const placed = screen.getByRole('button', { name: 'Lars' });
    fireEvent.click(placed);
    // Back in the bank, still selectable; not all placed.
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
  });
});
