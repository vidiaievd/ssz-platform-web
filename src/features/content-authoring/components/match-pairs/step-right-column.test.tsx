import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, coverage, type MatchPairs } from '@/lib/shared-kernel/match-pairs';

import { StepRightColumn } from './step-right-column';

function doc(overrides: Partial<MatchPairs> = {}): MatchPairs {
  return {
    id: 'ex-1',
    type: 'match_pairs',
    moduleId: 'module-1',
    title: 'Leddsetninger',
    instructions: 'Sett sammen halvdelene.',
    variant: 'halves',
    settings: { ...DEFAULT_SETTINGS },
    pairs: [
      { id: 'p1', rightId: 'h1', left: 'Hvis det regner i morgen,', right: 'blir vi hjemme.' },
      {
        id: 'p2',
        rightId: 'h2',
        left: 'Jeg rakk ikke bussen fordi',
        right: 'jeg sto opp for sent.',
      },
      { id: 'p3', rightId: 'h3', left: 'Hun sa at', right: 'hun kom senere.' },
    ],
    distractors: [{ id: 'h9', text: 'vi blir hjemme.' }],
    feedback: {},
    updatedAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  };
}

function Harness({
  initial,
  onChange,
  onEditPairs,
}: {
  initial: MatchPairs;
  onChange?: (next: MatchPairs) => void;
  onEditPairs?: () => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepRightColumn
        exercise={exercise}
        {...(onEditPairs === undefined ? {} : { onEditPairs })}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: MatchPairs, onEditPairs?: () => void) {
  const onChange = vi.fn();
  render(
    <Harness initial={initial} onChange={onChange} {...(onEditPairs ? { onEditPairs } : {})} />,
  );
  return { user: userEvent.setup(), onChange };
}

const extraField = () => screen.getByRole('textbox', { name: 'Extra halves' });

describe('StepRightColumn', () => {
  it('shows the correct halves locked, numbered and in author order (AC-B10)', () => {
    renderStep(doc());

    const list = screen.getByText('blir vi hjemme.').closest('ul')!;
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1blir vi hjemme.', '2jeg sto opp for sent.', '3hun kom senere.']);
    // Nothing here is an input: the answer is written once, in step 1.
    expect(within(list).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sends the teacher back to step 1 to change an answer', async () => {
    const onEditPairs = vi.fn();
    const { user } = renderStep(doc(), onEditPairs);

    await user.click(screen.getByRole('button', { name: 'Edit in step 1' }));

    expect(onEditPairs).toHaveBeenCalled();
  });

  it('refuses an extra half that reads like a correct one, at the input (AC-B11)', async () => {
    const { user, onChange } = renderStep(doc());

    await user.type(extraField(), '  BLIR VI  hjemme. ');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That is already a correct half. An extra half must complete nothing.',
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses an extra half already in the pool', async () => {
    const { user } = renderStep(doc());

    await user.type(extraField(), 'vi blir hjemme.');

    expect(screen.getByRole('alert')).toHaveTextContent('That extra half is already in the pool.');
  });

  it('adds an extra half on Enter and clears the field', async () => {
    const { user, onChange } = renderStep(doc());

    await user.type(extraField(), 'vi bodde i Bergen.{Enter}');

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.distractors.map((distractor) => distractor.text)).toEqual([
      'vi blir hjemme.',
      'vi bodde i Bergen.',
    ]);
    expect(extraField()).toHaveValue('');
  });

  it('removing an extra half takes its overrides with it (AC-B12)', async () => {
    const seeded = doc({
      feedback: {
        p1: { def: 'a', why: '', ov: { h9: { text: 'word order', origin: 'author' } } },
        p2: { def: 'b', why: '', ov: { h9: { text: 'word order', origin: 'author' } } },
      },
    });
    expect(coverage(seeded).written).toBe(2);

    const { user, onChange } = renderStep(seeded);
    await user.click(
      screen.getByRole('button', { name: 'Remove the extra half “vi blir hjemme.”' }),
    );

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.distractors).toEqual([]);
    expect(coverage(next).written).toBe(0);
  });

  it('warns that the last match is free when extras are on and none are written (AC-B13)', () => {
    renderStep(doc({ distractors: [] }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'The student sees 3 right halves for 3 gaps. With no extras written, the final match is a giveaway.',
    );
  });

  it('keeps the extras and their explanations when the toggle goes off and on (AC-B14)', async () => {
    const seeded = doc({
      feedback: { p1: { def: 'a', why: '', ov: { h9: { text: 'word order', origin: 'author' } } } },
    });
    const { user, onChange } = renderStep(seeded);

    await user.click(screen.getByRole('switch', { name: /Use extra halves/ }));

    const off = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(off.settings.distractors).toBe(false);
    expect(off.distractors).toHaveLength(1);
    expect(off.feedback['p1']?.ov['h9']?.text).toBe('word order');
    // Out of the pool, so out of the matrix: the coverage total shrinks, the text stays.
    expect(coverage(off).total).toBe(coverage(seeded).total - 3);

    await user.click(screen.getByRole('switch', { name: /Use extra halves/ }));

    const on = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(coverage(on)).toEqual(coverage(seeded));
  });

  it('states the live pool counts (AC-B15)', async () => {
    const { user } = renderStep(doc());

    expect(screen.getByRole('status')).toHaveTextContent(
      'The student sees 4 right halves for 3 gaps.',
    );

    await user.type(extraField(), 'vi bodde i Bergen.{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent(
      'The student sees 5 right halves for 3 gaps.',
    );
  });

  it('reports two halves that read the same as a blocker (AC-X8)', () => {
    renderStep(
      doc({
        pairs: [
          { id: 'p1', rightId: 'h1', left: 'Hun sa at', right: 'hun kom senere.' },
          { id: 'p2', rightId: 'h2', left: 'Han sa at', right: 'Hun kom  senere.' },
          { id: 'p3', rightId: 'h3', left: 'Jeg tror', right: 'det går bra.' },
        ],
        distractors: [],
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Two right halves read the same');
  });

  it('offers the near-miss empty state instead of a bare field', () => {
    renderStep(doc({ distractors: [] }));

    expect(screen.getByText('No extra halves yet')).toBeInTheDocument();
  });

  it('says that checking is not configurable (§1.3)', () => {
    renderStep(doc());

    expect(screen.getByText('Checking is one Sjekk for the whole exercise.')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /per pair/i })).not.toBeInTheDocument();
  });

  it('has no serious or critical accessibility violations (AC-X2)', async () => {
    const { container } = render(<Harness initial={doc()} />);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
