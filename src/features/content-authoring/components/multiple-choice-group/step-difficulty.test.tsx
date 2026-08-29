import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Settings } from '@/lib/shared-kernel/multiple-choice-group';
import {
  exercise,
  row,
  settings,
  RIGHT,
  WRONG,
} from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import { StepDifficulty } from './step-difficulty';
import type { MultipleChoiceGroupDocument } from './edits';

function doc(overrides: Partial<Settings> = {}): MultipleChoiceGroupDocument {
  return { updatedAt: '2026-08-29T10:00:00.000Z', ...exercise({ settings: settings(overrides) }) };
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
      <StepDifficulty
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

describe('StepDifficulty', () => {
  it('writes a switch straight onto the document', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc(), onChange);

    await user.click(screen.getByRole('switch', { name: /Shuffle the statement order/ }));

    expect((onChange.mock.calls[0]![0] as MultipleChoiceGroupDocument).settings.shuffleRows).toBe(
      true,
    );
  });

  it('restates the pass mark in rows of the table as it stands', async () => {
    const user = renderStep(doc({ passThreshold: 70 }));

    expect(screen.getByText('3 of 4 statements right.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'All right' }));

    expect(screen.getByText('4 of 4 statements right.')).toBeInTheDocument();
  });

  it('counts only the finished rows towards the pass mark', () => {
    render(
      <Harness
        initial={{
          updatedAt: '2026-08-29T10:00:00.000Z',
          ...exercise({
            rows: [row('Ferdig.', RIGHT.id), row('Ferdig to.', WRONG.id), row('Halvveis.')],
            settings: settings({ passThreshold: 100 }),
          }),
        }}
      />,
    );

    expect(screen.getByText('2 of 2 statements right.')).toBeInTheDocument();
  });

  it('says beside the switches that a one-shot table with no key teaches nothing', () => {
    renderStep(doc({ retry: 'none', revealKey: false }));

    expect(screen.getByText(/never learn what was wrong/)).toBeInTheDocument();
  });

  it('says that unlimited retries with nothing locked can be brute-forced', () => {
    renderStep(doc({ retry: 'unlimited', lockCorrect: false }));

    expect(screen.getByText(/brute-forced/)).toBeInTheDocument();
  });

  it('keeps quiet when the settings agree with each other', () => {
    renderStep();

    expect(screen.queryByText(/never learn what was wrong/)).toBeNull();
    expect(screen.queryByText(/brute-forced/)).toBeNull();
  });
});
