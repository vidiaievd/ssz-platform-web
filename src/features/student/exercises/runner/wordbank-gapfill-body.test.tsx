import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { StudentProjection } from '@/lib/shared-kernel/wordbank-gapfill';

import { WordBankGapFillBody, type GapFillValue, type GapVerdict } from './wordbank-gapfill-body';

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

/* ── check, feedback and reveal (step 3.2) ─────────────────────────────── */

function FeedbackHarness({
  results,
  revealed,
  value = { 's1#3': 'bestilt', 's2#3': 'regningen' },
  showFeedback = true,
}: {
  results?: Record<string, GapVerdict>;
  revealed?: Record<string, string>;
  value?: GapFillValue;
  showFeedback?: boolean;
}) {
  const [current, setCurrent] = useState<GapFillValue>(value);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordBankGapFillBody
        projection={makeProjection()}
        value={current}
        onValueChange={setCurrent}
        onAnswerChange={vi.fn()}
        phase="answering"
        mode="practice"
        accent="var(--ssz-runner-practice)"
        results={results}
        revealed={revealed}
        showFeedback={showFeedback}
      />
    </NextIntlClientProvider>
  );
}

const CHECKED = {
  's1#3': { correct: false, explanation: '«bestilt» is the past participle and needs «har».' },
  's2#3': { correct: true, explanation: 'Your own bill is a specific thing.' },
};

describe('WordBankGapFillBody — after a check', () => {
  it('AC-S7 / AC-S8: shows the explanation the server resolved for the wrong word', () => {
    render(<FeedbackHarness results={CHECKED} />);
    expect(
      screen.getByText(/past participle and needs «har»/, { exact: false }),
    ).toBeInTheDocument();
  });

  it('AC-S9: shows why the right answer is right', () => {
    render(<FeedbackHarness results={CHECKED} />);
    expect(screen.getByText(/Your own bill is a specific thing/)).toBeInTheDocument();
  });

  it('never shows an empty feedback block when the teacher wrote nothing', () => {
    render(
      <FeedbackHarness
        results={{ 's1#3': { correct: false, explanation: null }, ...{} }}
        value={{ 's1#3': 'bestilt' }}
      />,
    );
    // A verdict with no explanation still says which gap and that it is wrong,
    // rather than rendering a bare dash.
    expect(screen.getByText(/G1 — Not this one/)).toBeInTheDocument();
  });

  it('announces a wrong gap to assistive tech, and does not shout about a right one', () => {
    render(<FeedbackHarness results={CHECKED} />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('G1');
  });

  it('AC-S7 / AC-S10: a correct gap locks, a wrong one stays editable', async () => {
    const user = userEvent.setup();
    render(<FeedbackHarness results={CHECKED} />);

    expect(gap('G2')).toBeDisabled();
    expect(gap('G1')).toBeEnabled();

    await user.click(gap('G1'));
    expect(gap('G1')).toHaveAccessibleName('G1: empty gap');
  });

  it('puts the verdict in the accessible name, not only in the colour', () => {
    render(<FeedbackHarness results={CHECKED} />);
    expect(gap('G1')).toHaveAccessibleName('G1: bestilt, wrong');
    expect(gap('G2')).toHaveAccessibleName('G2: regningen, correct');
  });

  it('drops the hint once there is a verdict to read instead', () => {
    render(<FeedbackHarness results={CHECKED} />);
    expect(screen.queryByText('Du skal betale nå.')).not.toBeInTheDocument();
  });

  it('AC-S12: shows no answer until the reveal is asked for', () => {
    render(<FeedbackHarness results={CHECKED} />);

    // The bank still holds every word, correct ones included — that is what a bank
    // is, and the learner needs it to fix the gap. What must not appear is the
    // answer *in the gap* or named in the explanation.
    expect(gap('G1')).toHaveAccessibleName('G1: bestilt, wrong');
    expect(screen.queryByText(/the answer is/)).not.toBeInTheDocument();
    expect(screen.getByText(/G1 — Not this one/).textContent).not.toContain('bestille');
  });
});

describe('WordBankGapFillBody — after a reveal', () => {
  const revealed = { 's1#3': 'bestille', 's2#3': 'regningen' };

  it('AC-S12: fills every gap with its answer and hides the bank', () => {
    render(<FeedbackHarness results={CHECKED} revealed={revealed} />);

    expect(gap('G1')).toHaveAccessibleName('G1: the answer is bestille');
    expect(screen.queryByRole('group', { name: 'Word bank' })).not.toBeInTheDocument();
  });

  // After a reveal the verdicts carry the answer's own note, and a gap the teacher
  // wrote nothing for carries null.
  const NOTES = {
    's1#3': { correct: false, explanation: 'Infinitive after «vil gjerne».' },
    's2#3': { correct: true, explanation: null },
  };

  it('ends the attempt: no gap takes a word any more', async () => {
    const user = userEvent.setup();
    render(<FeedbackHarness results={NOTES} revealed={revealed} showFeedback={false} />);

    // The gap with nothing to read stays inert; the one with a note becomes its
    // trigger — and pressing that must still not put a word anywhere.
    expect(gap('G2')).toBeDisabled();
    await user.click(gap('G1'));
    expect(gap('G1')).toHaveAccessibleName('G1: the answer is bestille');
  });

  it('offers the note on the answer itself, on hover as well as on press', async () => {
    const user = userEvent.setup();
    render(<FeedbackHarness results={NOTES} revealed={revealed} showFeedback={false} />);

    expect(screen.queryByText(/Infinitive after/)).not.toBeInTheDocument();

    await user.hover(gap('G1'));
    expect(await screen.findByText(/Infinitive after/)).toBeInTheDocument();

    await user.unhover(gap('G1'));
    await waitFor(() => expect(screen.queryByText(/Infinitive after/)).not.toBeInTheDocument());

    // A tap has to work too — a touch screen never hovers.
    await user.click(gap('G1'));
    expect(await screen.findByText(/Infinitive after/)).toBeInTheDocument();
  });

  it('says a reveal happened on the live line, since nothing else announces it', () => {
    render(<FeedbackHarness results={CHECKED} revealed={revealed} showFeedback={false} />);
    expect(screen.getByText(/The answers are filled in above/)).toBeInTheDocument();
  });

  it('drops the hint: the answer is on screen, so help before the fact is noise', () => {
    render(<FeedbackHarness results={CHECKED} revealed={revealed} showFeedback={false} />);
    expect(screen.queryByText('Du skal betale nå.')).not.toBeInTheDocument();
  });

  // The accessible name and the visible text are two renderings of the same fact and
  // drifted apart once already: the label said "the answer is bestille" while the gap
  // still showed the learner's «bestilt». Sighted learners saw the wrong word.
  it('puts the answer in the gap itself, not only in its accessible name', () => {
    render(<FeedbackHarness results={CHECKED} revealed={revealed} />);
    expect(gap('G1')).toHaveTextContent('bestille');
  });
});

describe('WordBankGapFillBody — verdict styling', () => {
  it('tones the gap itself, so the verdict is visible where the mistake is', () => {
    render(<FeedbackHarness results={CHECKED} />);
    expect(gap('G1')).toHaveStyle({ color: 'var(--ssz-feedback-no-fg)' });
    expect(gap('G2')).toHaveStyle({ color: 'var(--ssz-feedback-ok-fg)' });
  });

  it('leaves an unchecked gap in the neutral tone', () => {
    render(<FeedbackHarness value={{}} />);
    expect(gap('G1')).toHaveStyle({ color: 'var(--ssz-text-primary)' });
  });
});

/* ── free-input mode (step 3.3) ────────────────────────────────────────── */

function TypedHarness({
  results,
  revealed,
  onAnswerChange = vi.fn(),
}: {
  results?: Record<string, GapVerdict>;
  revealed?: Record<string, string>;
  onAnswerChange?: (allFilled: boolean) => void;
}) {
  const [value, setValue] = useState<GapFillValue>({});
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordBankGapFillBody
        projection={makeProjection({
          bank: null,
          settings: { allowReuse: false, showBankCount: true, input: 'free' },
        })}
        value={value}
        onValueChange={setValue}
        onAnswerChange={onAnswerChange}
        phase="answering"
        mode="practice"
        accent="var(--ssz-runner-practice)"
        results={results}
        revealed={revealed}
      />
    </NextIntlClientProvider>
  );
}

const field = (label: string) => screen.getByRole('textbox', { name: new RegExp(`^${label}:`) });

describe('WordBankGapFillBody — typed instead of chosen', () => {
  it('gives every gap a text field and no bank', () => {
    render(<TypedHarness />);
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Word bank' })).not.toBeInTheDocument();
  });

  it('keeps what the learner typed, æ ø å included', async () => {
    const user = userEvent.setup();
    render(<TypedHarness />);

    await user.type(field('G1'), 'blåbær');
    expect(field('G1')).toHaveValue('blåbær');
  });

  it('reports readiness once every field has something in it', async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();
    render(<TypedHarness onAnswerChange={onAnswerChange} />);

    await user.type(field('G1'), 'bestille');
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
    await user.type(field('G2'), 'regningen');
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('turns off the keyboard aids that would answer for the learner', () => {
    render(<TypedHarness />);
    // A phone "correcting" a Norwegian inflection marks the learner wrong for the
    // device's opinion, which is not what is being tested.
    expect(field('G1')).toHaveAttribute('autocorrect', 'off');
    expect(field('G1')).toHaveAttribute('spellcheck', 'false');
  });

  it('gives every gap the same width, so the answer length is not a hint', () => {
    render(<TypedHarness />);
    const widths = screen.getAllByRole('textbox').map((el) => el.style.width);
    expect(new Set(widths).size).toBe(1);
  });

  it('locks a field the learner got right and leaves the wrong one editable', () => {
    render(
      <TypedHarness
        results={{
          's1#3': { correct: false, explanation: 'Not that form.' },
          's2#3': { correct: true, explanation: null },
        }}
      />,
    );
    expect(field('G2')).toBeDisabled();
    expect(field('G1')).toBeEnabled();
  });

  it('shows the answer in the field once it is revealed', () => {
    render(
      <TypedHarness
        results={{ 's1#3': { correct: false, explanation: null } }}
        revealed={{ 's1#3': 'bestille', 's2#3': 'regningen' }}
      />,
    );
    // The field is gone once there is nothing left to type: the answer reads as a
    // word in the sentence, the same as in a chosen-word exercise.
    expect(screen.queryByRole('textbox', { name: /^G1:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^G1:/ })).toHaveTextContent('bestille');
  });
});
