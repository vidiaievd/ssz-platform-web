import { useState } from 'react';
import { render, screen } from '@testing-library/react';
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
  settings,
  RIGHT,
  WRONG,
} from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import { StepFeedback } from './step-feedback';
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

const PASSAGE = {
  mode: 'inline' as const,
  label: 'Tekst 1A',
  text: 'Bartek søker ny jobb. Han skriver en søknad hver uke.',
};

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
      <StepFeedback
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

describe('StepFeedback', () => {
  it('gives a card to the finished statements only, in the author order', () => {
    renderStep(
      doc({ rows: [row('Ferdig.', RIGHT.id), row('Halvveis.'), row('Ferdig to.', WRONG.id)] }),
    );

    expect(screen.getByText('Ferdig.')).toBeInTheDocument();
    expect(screen.getByText('Ferdig to.')).toBeInTheDocument();
    expect(screen.queryByText('Halvveis.')).toBeNull();
  });

  it('says there is nothing to explain while no statement is finished', () => {
    renderStep(doc({ rows: [row('Halvveis.')] }));

    expect(screen.getByText(/show up here for their explanation/)).toBeInTheDocument();
  });

  it('marks a missing line while explanations are shown', () => {
    renderStep(doc({ rows: [row('Ferdig.', RIGHT.id)] }));

    expect(screen.getByText('Students see nothing under this statement.')).toBeInTheDocument();
  });

  it('drops the required state when nothing is ever explained', () => {
    renderStep(doc({ rows: [row('Ferdig.', RIGHT.id)], settings: settings({ showWhy: 'never' }) }));

    expect(screen.queryByText('Students see nothing under this statement.')).toBeNull();
  });

  it('offers no quote field while no passage is attached', () => {
    renderStep(doc({ rows: [row('Ferdig.', RIGHT.id, { why: 'Fordi.' })] }));

    expect(screen.queryByLabelText('Line from the text')).toBeNull();
  });

  it('offers the quote once the passage is pasted in', () => {
    renderStep(doc({ source: PASSAGE, rows: [row('Ferdig.', RIGHT.id, { why: 'Fordi.' })] }));

    expect(screen.getByLabelText('Line from the text')).toBeInTheDocument();
  });

  it('reports a quote that is not in the passage, and stays quiet about one that is', async () => {
    const user = renderStep(
      doc({ source: PASSAGE, rows: [row('Ferdig.', RIGHT.id, { why: 'Fordi.' })] }),
    );

    await user.type(screen.getByLabelText('Line from the text'), 'sykler i mørket');
    expect(screen.getByText(/not in the text/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Line from the text'));
    await user.type(screen.getByLabelText('Line from the text'), 'søker ny jobb');
    expect(screen.queryByText(/not in the text/)).toBeNull();
  });

  it('counts the coverage over the finished statements', () => {
    renderStep(
      doc({
        source: PASSAGE,
        rows: [
          row('En.', RIGHT.id, { why: 'Fordi.', quote: 'søker ny jobb' }),
          row('To.', WRONG.id),
        ],
      }),
    );

    expect(screen.getByText('/ 2')).toBeInTheDocument();
    expect(screen.getByText(/1 statement quotes a line from the text/)).toBeInTheDocument();
  });

  it('writes the line onto the row it belongs to', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc({ rows: [row('Ferdig.', RIGHT.id)] }), onChange);

    await user.type(screen.getByLabelText('Why'), 'F');

    const next = onChange.mock.calls[0]![0] as MultipleChoiceGroupDocument;
    expect(next.rows[0]!.why).toBe('F');
  });
});
