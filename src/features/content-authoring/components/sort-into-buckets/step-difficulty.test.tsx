import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE, type SortIntoBucketsContent } from '@/lib/shared-kernel/sort-into-buckets';
import { exercise } from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { StepDifficulty } from './step-difficulty';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(initial: SortIntoBucketsContent) {
  const seen: { current: SortIntoBucketsContent } = { current: initial };

  function Harness() {
    const [ex, setEx] = useState(initial);
    const [audio, setAudio] = useState(readAudioDraft({}, TEMPLATE_CODE));
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepDifficulty
          exercise={ex}
          onChange={(next) => {
            seen.current = next;
            setEx(next);
          }}
          audio={audio}
          onAudioChange={setAudio}
        />
      </NextIntlClientProvider>
    );
  }

  const view = render(<Harness />);
  return { user: userEvent.setup(), seen, ...view };
}

const ENABLE = enMessages.Authoring.audio.enableLabel;
const MODE = enMessages.Authoring.audio.modeLabel;

describe('StepDifficulty', () => {
  it('warns about the counter without a refusal bucket, right beside the switch (AC-D1)', async () => {
    const { user } = renderStep(exercise());

    expect(screen.queryByText(/turns the last tiles into arithmetic. Add/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Show how many are left/ }));
    expect(screen.getByText(/turns the last tiles into arithmetic. Add/)).toBeInTheDocument();
  });

  it('says the evidence ceiling drops with the counter, a refusal bucket or not (phase 9)', async () => {
    const { user } = renderStep({ ...exercise(), useNone: true, noneLabel: 'Ingen av delene' });
    const lowered = /counts as weaker evidence/;

    expect(screen.queryByText(lowered)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Show how many are left/ }));
    expect(
      screen.getByText(/With the counter on, a right answer here counts as weaker/),
    ).toBeInTheDocument();
    // The refusal bucket silences the arithmetic, not the ceiling.
    expect(screen.queryByText(/turns the last tiles into arithmetic. Add/)).not.toBeInTheDocument();
  });

  it('restates the pass mark in items as the slider moves (AC-D2)', () => {
    renderStep(exercise());

    // 70% of six ready items is five.
    expect(screen.getByText('5 of 6 items right on the first check.')).toBeInTheDocument();
  });

  it('moves the pass mark and the number it shows together', () => {
    const { seen } = renderStep(exercise());

    fireEvent.change(screen.getByRole('slider'), { target: { value: '90' } });

    expect(seen.current.settings.threshold).toBe(90);
    // 90% of six is 5.4, so six.
    expect(screen.getByText('6 of 6 items right on the first check.')).toBeInTheDocument();
  });

  it('changes nothing but settings (AC-D4)', async () => {
    const start = exercise();
    const { user, seen } = renderStep(start);

    await user.click(screen.getByRole('switch', { name: /Shuffle the items/ }));
    await user.click(screen.getByRole('radio', { name: '2' }));
    await user.click(screen.getByRole('switch', { name: /Show the answers at the end/ }));

    expect(seen.current.buckets).toBe(start.buckets);
    expect(seen.current.items).toBe(start.items);
    expect(seen.current.fb).toBe(start.fb);
    expect(seen.current.settings).toMatchObject({ shuffle: false, attempts: 2, revealKey: false });
  });

  it('warns about one check with the key shown, and offers the audio layer', async () => {
    const { user } = renderStep(exercise());

    await user.click(screen.getByRole('radio', { name: '1' }));
    expect(screen.getByText(/sees the key after a single try/)).toBeInTheDocument();

    // The layer's rules appear only once it is switched on.
    expect(screen.queryByText('How the clip may be heard')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: new RegExp(ENABLE) }));
    expect(screen.getByText(MODE)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderStep(exercise());
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
