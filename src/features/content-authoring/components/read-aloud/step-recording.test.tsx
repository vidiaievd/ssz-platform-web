import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { emptyContent, newPrompt } from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';
import { setSeconds } from './edits';
import { StepRecording } from './step-recording';
import { documentOf, Harness, PAGE_RULES, sampleReadAloud } from './test-support';

function renderStep(initial: ReadAloudDocument, onChange?: (next: ReadAloudDocument) => void) {
  const view = render(<Harness initial={initial} step={StepRecording} onChange={onChange} />);
  return { user: userEvent.setup(), ...view };
}

describe('StepRecording — takes and switches (RA-B11)', () => {
  it('sets one to three takes', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (d) => seen.push(d));
    const takes = screen.getByRole('radiogroup', { name: 'Takes per prompt' });
    expect(within(takes).getAllByRole('radio')).toHaveLength(3);
    await user.click(within(takes).getByRole('radio', { name: '1' }));
    expect(seen.at(-1)?.recording.takes).toBe(1);
  });

  it('flips each of the five switches in its own field', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (d) => seen.push(d));
    const flips: [string, keyof ReadAloudDocument['recording']][] = [
      ['Choose the best take', 'chooseBest'],
      ['Listen back before submitting', 'listenBack'],
      ['Countdown before the microphone opens', 'countdown'],
      ['Microphone check first', 'micCheck'],
      ['Send the discarded takes too', 'keepAllTakes'],
    ];
    for (const [label, field] of flips) {
      const before = (seen.at(-1) ?? sampleReadAloud()).recording[field];
      await user.click(screen.getByRole('switch', { name: new RegExp(label) }));
      expect(seen.at(-1)?.recording[field]).toBe(!before);
    }
  });

  it('says what a missing check or a blind retake costs, on the card they belong to', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(screen.getByRole('switch', { name: /Microphone check first/ }));
    expect(screen.getByText(/No microphone check\. Silent recordings/)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Listen back before submitting/ }));
    expect(screen.getByText(/takes with listen-back off/)).toBeInTheDocument();
  });
});

describe('StepRecording — lengths (RA-B12)', () => {
  it('shows the three numbers of each prompt and edits them', async () => {
    const { user } = renderStep(sampleReadAloud());
    const first = screen.getByRole('group', { name: 'Avsnitt 1' });
    expect(within(first).getByLabelText('Prep')).toHaveValue(20);
    expect(within(first).getByLabelText('Min')).toHaveValue(15);
    const max = within(first).getByLabelText('Max');
    expect(max).toHaveValue(60);
    await user.clear(max);
    await user.type(max, '90');
    expect(max).toHaveValue(90);
    expect(within(first).getByText(/270 KB/)).toBeInTheDocument();
  });

  it('says how long the passage reads, and only in read mode', () => {
    const { unmount } = renderStep(sampleReadAloud());
    expect(screen.getAllByText(/text reads in/)).toHaveLength(2);
    unmount();
    renderStep({ ...sampleReadAloud(), mode: 'monologue' });
    expect(screen.queryByText(/text reads in/)).not.toBeInTheDocument();
  });

  it('caps preparation at two minutes', async () => {
    const { user } = renderStep(sampleReadAloud());
    const prep = within(screen.getByRole('group', { name: 'Avsnitt 1' })).getByLabelText('Prep');
    await user.clear(prep);
    await user.type(prep, '500');
    expect(prep).toHaveValue(120);
  });

  it('states the envelope and the most one student sends', () => {
    renderStep(sampleReadAloud());
    // 2 prompts × 60 s × 3 KB/s = 360 KB; one take each unless the discards are sent.
    expect(screen.getByText(/Upload envelope:/)).toHaveTextContent(
      'Upload envelope: audio/webm;codecs=opus, 3:00 and 8 MB hard ceiling, stored as submission_recording against the submission. This exercise sends at most 360 KB per student.',
    );
  });

  it('multiplies the envelope by the takes when the discards are sent too', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(screen.getByRole('switch', { name: /Send the discarded takes too/ }));
    expect(screen.getByText(/Upload envelope:/)).toHaveTextContent('at most 1080 KB');
  });

  it('marks a range with nothing to submit and a maximum over the ceiling, on the prompt', () => {
    const base = sampleReadAloud();
    renderStep(
      setSeconds(setSeconds(base, 'p1aaaa', 'maxSeconds', 200), 'p2bbbb', 'minSeconds', 99),
    );
    const first = screen.getByRole('group', { name: 'Avsnitt 1' });
    expect(
      within(first).getByText(/allows 3:20 — over the 3:00 upload ceiling/),
    ).toBeInTheDocument();
    const second = screen.getByRole('group', { name: 'Avsnitt 2' });
    expect(within(second).getByText(/the minimum is not below the maximum/)).toBeInTheDocument();
  });

  it('warns that the passage will not fit in the time', () => {
    const base = emptyContent('nb');
    const long = Array(80).fill('ord').join(' ');
    renderStep(
      documentOf({
        ...base,
        prompts: [{ ...newPrompt('read'), id: 'p1', text: long, maxSeconds: 20 }],
      }),
    );
    expect(
      screen.getByText(/takes about 0:46 to read aloud but stops at 0:20/),
    ).toBeInTheDocument();
  });
});

describe('StepRecording — a11y', () => {
  it('has no axe violations', async () => {
    const { container } = renderStep(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
