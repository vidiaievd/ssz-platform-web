import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, newSegment, type DictationContent } from '@/lib/shared-kernel/dictation';

import { StepDifficulty } from './step-difficulty';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function Harness({
  initial,
  spy,
}: {
  initial: DictationContent;
  spy: (ex: DictationContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepDifficulty
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: DictationContent) {
  const spy = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness initial={initial} spy={spy} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...view, spy, last: () => spy.mock.calls.at(-1)?.[0] as DictationContent };
}

function keyed(patch: Partial<DictationContent> = {}): DictationContent {
  return {
    ...emptyContent('nb'),
    segments: [{ ...newSegment(), text: 'Jeg hørte kjøkkenet i går.' }],
    ...patch,
  };
}

/** A radio of one of the segmented controls — the digits repeat across listens and attempts. */
const choice = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name });

const ceiling = () => screen.getByTestId('dc-ceiling');

describe('StepDifficulty', () => {
  it('sets who may read the transcript, and calls «always» a blocker (AC-B9)', async () => {
    const { last } = draw(keyed());
    expect(screen.getByRole('radio', { name: 'After the check' })).toBeChecked();
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Always' }));
    expect(last().audio.settings.transcriptWhen).toBe('always');
    expect(screen.getByRole('alert')).toHaveTextContent(/it is the answer key/);

    await userEvent.click(screen.getByRole('radio', { name: 'Never' }));
    expect(last().audio.settings.transcriptWhen).toBe('never');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has no transcript text to write — the key is the transcript', () => {
    draw(keyed());
    expect(screen.queryByLabelText('What the clip says')).toBeNull();
  });

  it('says where the evidence ceiling comes from (AC-B11)', async () => {
    draw(keyed());
    expect(ceiling()).toHaveAttribute('data-cause', 'none');

    await userEvent.click(screen.getByRole('switch', { name: /Show how many words/ }));
    expect(ceiling()).toHaveAttribute('data-cause', 'count');
    expect(ceiling()).toHaveTextContent(/word counter/);

    await userEvent.click(screen.getByRole('radio', { name: 'Always' }));
    expect(ceiling()).toHaveAttribute('data-cause', 'both');

    await userEvent.click(screen.getByRole('switch', { name: /Show how many words/ }));
    expect(ceiling()).toHaveAttribute('data-cause', 'transcript');
  });

  it('writes the delivery switches and the attempts', async () => {
    const { last } = draw(keyed());
    await userEvent.click(screen.getByRole('switch', { name: /Show the reason/ }));
    expect(last().settings.hints).toBe(false);
    await userEvent.click(screen.getByRole('switch', { name: /reveal the correct sentence/ }));
    expect(last().settings.revealKey).toBe(false);

    await userEvent.click(choice('Attempts per sentence', '1'));
    expect(last().settings.attempts).toBe(1);
    // One check and no way to see the key leaves nothing to learn from.
    expect(screen.getByText(/One check and no way to see the key/)).toBeInTheDocument();
  });

  it('turns the pass mark into words of the first sentence', () => {
    // 5 words at 80% → 4.
    draw(keyed());
    expect(screen.getByText('4 of 5 words in segment 1.')).toBeInTheDocument();
  });

  it('says what 100% means, and takes the mark from the slider', async () => {
    const { last } = draw(keyed());
    const slider = screen.getByRole('slider', { name: /Pass mark — 80%/ });
    expect(slider).toHaveAttribute('step', '5');
    fireEvent.change(slider, { target: { value: '85' } });
    expect(last().settings.threshold).toBe(85);

    fireEvent.change(slider, { target: { value: '100' } });
    expect(last().settings.threshold).toBe(100);
    expect(screen.getByText(/one wrong letter fails the sentence/)).toBeInTheDocument();
  });

  it('warns that one listen cannot carry more than two sentences', async () => {
    const segments = ['Ett to tre.', 'Fire fem seks.', 'Syv åtte ni.'].map((text) => ({
      ...newSegment(),
      text,
    }));
    draw(keyed({ segments }));
    await userEvent.click(choice('Times they may listen', '1'));
    expect(screen.getByText(/One listen has to carry 3 sentences/)).toBeInTheDocument();
  });

  it('offers per-sentence timecodes only by sentence', () => {
    const view = draw(keyed());
    expect(screen.getByText('Timecodes per item')).toBeInTheDocument();
    view.unmount();
    draw(keyed({ mode: 'whole' }));
    expect(screen.queryByText('Timecodes per item')).toBeNull();
  });

  it('has no axe violations (AC-X6)', async () => {
    const view = draw(keyed());
    expect(
      (
        await axe.run(view.container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });
});
