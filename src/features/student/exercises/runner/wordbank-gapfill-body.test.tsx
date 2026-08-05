import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { StudentProjection } from '@/lib/shared-kernel/wordbank-gapfill';

import { WordBankGapFillBody, type GapFillValue } from './wordbank-gapfill-body';

// The projection is what the server sends: gapped tokens already cut out, the bank
// already shuffled. Nothing here knows which word is correct — that is the point.
function makeProjection(overrides: Partial<StudentProjection> = {}): StudentProjection {
  return {
    sentences: [
      {
        id: 's1',
        tokens: [
          { kind: 'text', text: 'Jeg' },
          { kind: 'text', text: 'vil' },
          { kind: 'text', text: 'gjerne' },
          { kind: 'gap', gapKey: 's1#3', label: 'G1', before: '', after: '' },
          { kind: 'text', text: 'en' },
          { kind: 'text', text: 'kaffe.' },
        ],
      },
      {
        id: 's2',
        hint: 'Du skal betale nå.',
        tokens: [
          { kind: 'text', text: 'Kan' },
          { kind: 'text', text: 'jeg' },
          { kind: 'text', text: 'få' },
          { kind: 'gap', gapKey: 's2#3', label: 'G2', before: '', after: ',' },
          { kind: 'text', text: 'takk?' },
        ],
      },
    ],
    bank: ['bestille', 'bestilt', 'regning', 'regningen'],
    settings: { allowReuse: false, showBankCount: true, input: 'bank' },
    ...overrides,
  };
}

/** Drives the controlled component the way the solver will. */
function Harness({
  projection = makeProjection(),
  onAnswerChange = vi.fn(),
}: {
  projection?: StudentProjection;
  onAnswerChange?: (allFilled: boolean) => void;
}) {
  const [value, setValue] = useState<GapFillValue>({});
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordBankGapFillBody
        projection={projection}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange}
        phase="answering"
        mode="practice"
        accent="var(--ssz-runner-practice)"
      />
    </NextIntlClientProvider>
  );
}

const gap = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}:`) });
const chip = (word: string) => screen.getByRole('button', { name: word });

describe('WordBankGapFillBody — placing words', () => {
  it('AC-S1: tapping a word with no gap armed fills the first empty gap', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(chip('bestille'));

    expect(gap('G1')).toHaveAccessibleName('G1: bestille');
    expect(gap('G2')).toHaveAccessibleName('G2: empty gap');
  });

  it('AC-S2: arming a gap sends the next word there instead', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(gap('G2'));
    await user.click(chip('regningen'));

    expect(gap('G2')).toHaveAccessibleName('G2: regningen');
    expect(gap('G1')).toHaveAccessibleName('G1: empty gap');
  });

  it('AC-S4: tapping a filled gap gives the word back', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(chip('bestille'));
    await user.click(gap('G1'));

    expect(gap('G1')).toHaveAccessibleName('G1: empty gap');
  });

  it('AC-S3: dropping a chip on a gap fills it', () => {
    render(<Harness />);

    // jsdom ships no DataTransfer, so the drag payload is stubbed. What is under
    // test is the drop handler reading `text/plain`, which is the contract the
    // chip's `onDragStart` writes to.
    const dataTransfer = { getData: (type: string) => (type === 'text/plain' ? 'regning' : '') };
    fireEvent.drop(gap('G2'), { dataTransfer });

    expect(gap('G2')).toHaveAccessibleName('G2: regning');
  });

  it('moves a word between gaps rather than duplicating it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(chip('bestille')); // → G1
    await user.click(gap('G2'));
    await user.click(chip('bestille')); // moves out of G1

    expect(gap('G2')).toHaveAccessibleName('G2: bestille');
    expect(gap('G1')).toHaveAccessibleName('G1: empty gap');
  });

  it('arms the next empty gap after a placement, so a run of taps just works', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(chip('bestille'));
    await user.click(chip('regningen'));

    expect(gap('G1')).toHaveAccessibleName('G1: bestille');
    expect(gap('G2')).toHaveAccessibleName('G2: regningen');
  });
});

describe('WordBankGapFillBody — the bank', () => {
  it('AC-S5: a spent word is marked used, not merely faded', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(chip('bestille'));

    // AC-X7: colour alone may not carry a state, so the chip is struck through too.
    expect(chip('bestille')).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('AC-S5: with allowReuse a word fills several gaps and is never spent', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        projection={makeProjection({
          settings: { allowReuse: true, showBankCount: true, input: 'bank' },
        })}
      />,
    );

    await user.click(chip('bestille'));
    await user.click(chip('bestille'));

    expect(gap('G1')).toHaveAccessibleName('G1: bestille');
    expect(gap('G2')).toHaveAccessibleName('G2: bestille');
    expect(chip('bestille')).toHaveStyle({ textDecoration: 'none' });
  });

  it('counts down the words still available when showBankCount is on', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText('4 left')).toBeInTheDocument();
    await user.click(chip('bestille'));
    expect(screen.getByText('3 left')).toBeInTheDocument();
  });

  it('hides the count when the teacher turned it off', () => {
    render(
      <Harness
        projection={makeProjection({
          settings: { allowReuse: false, showBankCount: false, input: 'bank' },
        })}
      />,
    );
    expect(screen.queryByText('4 left')).not.toBeInTheDocument();
  });

  it('shows no bank at all when the exercise is typed rather than chosen', () => {
    render(
      <Harness
        projection={makeProjection({
          bank: null,
          settings: { allowReuse: false, showBankCount: true, input: 'free' },
        })}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Word bank' })).not.toBeInTheDocument();
  });
});

describe('WordBankGapFillBody — what the learner is told', () => {
  it('AC-S6: reports readiness only once every gap is filled', async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();
    render(<Harness onAnswerChange={onAnswerChange} />);

    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    await user.click(chip('bestille'));
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    await user.click(chip('regningen'));
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('AC-S14: renders no answer, because the projection carries none', () => {
    const { container } = render(<Harness />);
    // The sentence keeps its punctuation but not its hidden word: the comma after
    // G2 belongs to the sentence, the word does not.
    expect(container.textContent).toContain('Kan jeg få');
    expect(container.textContent).toContain('takk?');
    expect(container.textContent).toContain(',');
  });

  it('shows the hint the teacher wrote for a sentence', () => {
    render(<Harness />);
    expect(screen.getByText('Du skal betale nå.')).toBeInTheDocument();
  });

  it('AC-X3: gaps are reachable and operable from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    gap('G2').focus();
    await user.keyboard('{Enter}');
    await user.click(chip('regningen'));

    expect(gap('G2')).toHaveAccessibleName('G2: regningen');
  });
});
