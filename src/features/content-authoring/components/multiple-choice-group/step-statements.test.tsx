import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE } from '@/lib/shared-kernel/multiple-choice-group';
import type { MultipleChoiceGroupContent } from '@/lib/shared-kernel/multiple-choice-group';
import {
  exercise,
  row,
  RIGHT,
  WRONG,
} from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import { StepStatements } from './step-statements';
import type { MultipleChoiceGroupDocument } from './edits';

function doc(overrides: Partial<MultipleChoiceGroupContent> = {}): MultipleChoiceGroupDocument {
  return {
    updatedAt: '2026-08-29T10:00:00.000Z',
    // Every builder document carries the audio layer, and an exercise that has never had
    // any reads as switched off (plan 56 phase 5).
    audio: readAudioDraft({}, TEMPLATE_CODE),
    ...exercise(overrides),
  };
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
      <StepStatements
        exercise={ex}
        language="nb"
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

describe('StepStatements', () => {
  it('marks a column and clears it on a second click', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc(), onChange);

    await user.click(screen.getByRole('radio', { name: 'Statement 1 is Galt' }));
    expect((onChange.mock.calls[0]![0] as MultipleChoiceGroupDocument).rows[0]!.answer).toBe(
      WRONG.id,
    );

    await user.click(screen.getByRole('radio', { name: 'Statement 1 is Galt' }));
    expect((onChange.mock.calls[1]![0] as MultipleChoiceGroupDocument).rows[0]!.answer).toBeNull();
  });

  it('reports a written statement with no answer where it is fixed', () => {
    renderStep(doc({ rows: [row('Bartek søker jobb.'), row('En til.', RIGHT.id)] }));

    expect(
      screen.getByText('No answer marked — this statement will not be shown.'),
    ).toBeInTheDocument();
  });

  it('says nothing about a row that is simply empty', () => {
    renderStep(doc({ rows: [row(''), row('En påstand.', RIGHT.id)] }));

    expect(screen.queryByText(/No answer marked/)).toBeNull();
  });

  it('counts the ready rows against every row', () => {
    renderStep(doc({ rows: [row('Skrevet.', RIGHT.id), row('Halvveis.'), row('')] }));

    expect(screen.getByText('1 of 3 ready')).toBeInTheDocument();
  });

  it('names an audit finding under the row it belongs to', () => {
    renderStep(
      doc({
        rows: [
          row('Alle syklister må ha lys.', RIGHT.id),
          row('En annen påstand.', WRONG.id),
          row('En tredje.', RIGHT.id),
        ],
      }),
    );

    expect(screen.getByText(/An absolute/)).toBeInTheDocument();
  });

  it('puts a group-scoped finding under the table, naming its column', () => {
    renderStep(
      doc({
        rows: [
          row('En.', RIGHT.id),
          row('To.', RIGHT.id),
          row('Tre.', RIGHT.id),
          row('Fire.', RIGHT.id),
        ],
      }),
    );

    expect(screen.getByText(/Column «Galt» — No statement is answered/)).toBeInTheDocument();
    expect(screen.getByText(/Column «Riktig» — 100% of the answers/)).toBeInTheDocument();
  });

  it('keeps the last row undeletable', () => {
    renderStep(doc({ rows: [row('Bare én.', RIGHT.id)] }));

    expect(screen.getByRole('button', { name: 'Delete statement 1' })).toBeDisabled();
  });

  it('adds pasted statements and drops the empty rows they replace', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc({ rows: [row('Skrevet.', RIGHT.id), row('')] }), onChange);

    await user.click(screen.getByRole('button', { name: 'Paste a list' }));
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Paste statements'),
      'Ny påstand. | G{enter}Uten svar.',
    );

    expect(within(dialog).getByText('2 statements, 1 with an answer.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Add 2 statements' }));

    const next = onChange.mock.calls.at(-1)![0] as MultipleChoiceGroupDocument;
    expect(next.rows.map((r) => r.text)).toEqual(['Skrevet.', 'Ny påstand.', 'Uten svar.']);
    expect(next.rows[1]!.answer).toBe(WRONG.id);
    expect(next.rows[2]!.answer).toBeNull();
  });
});
