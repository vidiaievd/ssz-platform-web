import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceGroupContent } from '@/lib/shared-kernel/multiple-choice-group';
import { exercise } from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import { StepSetup } from './step-setup';
import type { MultipleChoiceGroupDocument } from './edits';

function doc(overrides: Partial<MultipleChoiceGroupContent> = {}): MultipleChoiceGroupDocument {
  return { updatedAt: '2026-08-29T10:00:00.000Z', ...exercise(overrides) };
}

function Harness({
  initial,
  onChange,
}: {
  initial: MultipleChoiceGroupDocument;
  onChange?: (next: MultipleChoiceGroupDocument) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepSetup
        exercise={ex}
        onChange={(next) => {
          onChange?.(next);
          setEx(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(
  initial: MultipleChoiceGroupDocument = doc(),
  onChange?: (next: MultipleChoiceGroupDocument) => void,
) {
  render(<Harness initial={initial} onChange={onChange} />);
  return userEvent.setup();
}

describe('StepSetup', () => {
  it('presses the preset the columns match, and no other', () => {
    renderStep();

    expect(screen.getByRole('button', { name: /reading-comprehension default/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /written as questions/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('rebuilds the columns from a preset and carries the answers by name', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc(), onChange);

    await user.click(screen.getByRole('button', { name: /honest third answer/ }));

    const next = onChange.mock.calls[0]![0] as MultipleChoiceGroupDocument;
    expect(next.columns.map((c) => c.label)).toEqual(['Riktig', 'Galt', 'Står ikke i teksten']);
    // Same labels, new ids — and every answer moved with its label rather than its index.
    expect(next.rows.map((r) => r.answer)).toEqual([
      next.columns[0]!.id,
      next.columns[1]!.id,
      next.columns[0]!.id,
      next.columns[1]!.id,
    ]);
  });

  it('will not delete a column while there are only two', () => {
    renderStep();

    expect(screen.getByRole('button', { name: 'Remove column 1' })).toBeDisabled();
  });

  it('asks for the passage only in inline mode, and marks it missing while empty', async () => {
    const user = renderStep(doc({ source: { mode: 'none', label: '', text: '' } }));

    expect(screen.queryByLabelText('Text')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Paste it in' }));

    expect(screen.getByLabelText('Text')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/nothing is pasted in/)).toBeInTheDocument();
  });

  it('counts the words of a passage that is there', () => {
    renderStep(doc({ source: { mode: 'inline', label: 'Text 1A', text: 'En to tre fire.' } }));

    expect(screen.getByText(/4 words/)).toBeInTheDocument();
  });

  it('offers no lesson picker in link mode — the link goes to the lesson it sits under', async () => {
    const user = renderStep();

    await user.click(screen.getByRole('radio', { name: 'Link to lesson' }));

    expect(screen.getByText(/points back to the lesson it sits under/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Text')).toBeNull();
  });

  it('warns about a missing instruction without blocking anything', () => {
    renderStep(doc({ instruction: '  ' }));

    expect(screen.getByText('Students see nothing above the table.')).toBeInTheDocument();
  });
});
