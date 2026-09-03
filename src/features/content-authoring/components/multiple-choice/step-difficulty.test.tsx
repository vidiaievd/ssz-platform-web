import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE } from '@/lib/shared-kernel/multiple-choice';
import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceContent, Settings } from '@/lib/shared-kernel/multiple-choice';
import { content, settings } from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import { StepDifficulty } from './step-difficulty';
import type { MultipleChoiceDocument } from './edits';

function doc(overrides: Partial<Settings> = {}): MultipleChoiceDocument {
  const base: MultipleChoiceContent = content({ settings: settings(overrides) });
  return {
    updatedAt: '2026-08-28T10:00:00.000Z',
    // Every builder document carries the audio layer, and an exercise that has never had
    // any reads as switched off (plan 56 phase 4).
    audio: readAudioDraft({}, TEMPLATE_CODE),
    ...base,
  };
}

function Harness({
  initial,
  onChange,
}: {
  initial: MultipleChoiceDocument;
  onChange?: (next: MultipleChoiceDocument) => void;
}) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepDifficulty
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: MultipleChoiceDocument = doc(), onChange?: (next: MultipleChoiceDocument) => void) {
  render(<Harness initial={initial} onChange={onChange} />);
  return userEvent.setup();
}

describe('StepDifficulty', () => {
  it('writes a switch straight onto the document', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc(), onChange);

    await user.click(screen.getByRole('switch', { name: /Shuffle the questions/ }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ settings: expect.objectContaining({ shuffleQuestions: true }) }),
    );
  });

  it('carries the attempt budget on the segmented control', async () => {
    const onChange = vi.fn();
    const user = renderStep(doc(), onChange);

    await user.click(screen.getByRole('radio', { name: 'One shot' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ settings: expect.objectContaining({ retry: 'none' }) }),
    );
  });

  it('says instant plus retries lets a student tap until it turns green', () => {
    renderStep(doc({ instant: true, retry: 'one' }));

    expect(screen.getByText(/tap until one turns green/)).toBeInTheDocument();
  });

  it('says the 50/50 can never appear without a second attempt', () => {
    renderStep(doc({ eliminate: true, retry: 'none' }));

    expect(screen.getByText(/can never appear/)).toBeInTheDocument();
  });

  it('reports the contradiction on the step, not only in the gate', async () => {
    const user = renderStep(doc({ retry: 'one' }));

    expect(screen.queryByText(/tap until one turns green/)).toBeNull();

    await user.click(screen.getByRole('switch', { name: /Check as soon as they pick/ }));

    // Beside the switch that caused it: the gate is two clicks and a decision too late to
    // learn this about a setting you are looking at.
    expect(screen.getByText(/tap until one turns green/)).toBeInTheDocument();
  });

  it('keeps both contradictions as warnings, never as a block', () => {
    renderStep(doc({ instant: true, retry: 'unlimited', eliminate: true }));

    // `eliminate` with retries left is legal, so only one line shows — and neither is
    // rendered as an error.
    expect(screen.getByText(/tap until one turns green/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
