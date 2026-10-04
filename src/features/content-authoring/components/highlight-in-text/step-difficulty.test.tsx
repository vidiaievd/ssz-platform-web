import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE, type HighlightInTextContent } from '@/lib/shared-kernel/highlight-in-text';
import { exercise, settings } from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

const { StepDifficulty } = await import('./step-difficulty');

function Harness({
  initial,
  spy,
}: {
  initial: HighlightInTextContent;
  spy: (ex: HighlightInTextContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  const [audio, setAudio] = useState<AudioDraft>(readAudioDraft({}, TEMPLATE_CODE));
  return (
    <StepDifficulty
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
      audio={audio}
      onAudioChange={setAudio}
    />
  );
}

function draw(initial: HighlightInTextContent = exercise()) {
  const spy = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} />
    </NextIntlClientProvider>,
  );
  return { ...view, last: () => spy.mock.calls.at(-1)?.[0] as HighlightInTextContent };
}

describe('StepDifficulty', () => {
  it('works the penalty example on the first ready question', () => {
    draw();
    // 8 marks, half: (8 − 2 − 0.5·3) / 8 = 56%.
    expect(
      screen.getByText(
        /With 8 marks in “Marker alle verbene som står i p…”, finding all but two and adding three wrong scores 56%\./,
      ),
    ).toBeInTheDocument();
  });

  it('says «None» at error level, with the capped evidence (HT_PENALTY_OFF)', async () => {
    const { last } = draw();
    await userEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(last().settings.penalty).toBe('off');
    expect(screen.getByRole('alert')).toHaveTextContent(/Evidence from this exercise is capped/);
  });

  it('changes only the settings, never the text or the key', async () => {
    const before = exercise();
    const { last } = draw(before);
    await userEvent.click(screen.getByRole('radio', { name: 'A full mark' }));
    await userEvent.click(screen.getByRole('switch', { name: /Show the hint/ }));
    const after = last();
    expect(after.text).toBe(before.text);
    expect(after.questions).toEqual(before.questions);
    expect(after.settings).toEqual({ ...before.settings, penalty: 'full', hints: false });
  });

  it('warns under the counter that it caps the evidence (HT_COUNT_SHOWN)', async () => {
    draw();
    await userEvent.click(screen.getByRole('switch', { name: /Say how many marks are expected/ }));
    expect(screen.getByText(/Showing how many marks are expected/)).toBeInTheDocument();
  });

  it('warns about one attempt with the key shown (HT_ONE_SHOT_REVEAL)', async () => {
    draw();
    await userEvent.click(screen.getByRole('radio', { name: '1' }));
    expect(screen.getByText(/One attempt plus an answer key/)).toBeInTheDocument();
  });

  it('restates the pass mark in marks of the first question', () => {
    draw(exercise({ settings: settings({ threshold: 70 }) }));
    expect(screen.getByLabelText('Pass mark — 70% per question')).toHaveValue('70');
    expect(
      screen.getByText('6 of 8 marks in the first question, after the penalty.'),
    ).toBeInTheDocument();
  });

  it('turns the audio layer on with one clip — no per-item timecodes', async () => {
    draw();
    expect(screen.getByText(/Off\. With audio on/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('switch').at(-1)!);
    expect(screen.queryByText(/Off\. With audio on/)).toBeNull();
    expect(screen.queryByRole('switch', { name: /timecode|segment/i })).toBeNull();
  });
});
