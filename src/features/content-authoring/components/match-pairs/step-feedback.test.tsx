import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type MatchPairs } from '@/lib/shared-kernel/match-pairs';

import { StepFeedback } from './step-feedback';

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
    feedback: {
      p1: { def: 'Se på ordstillingen.', why: '', ov: {} },
      p2: { def: 'Etter «fordi» står subjektet først.', why: '', ov: {} },
      p3: { def: 'Se på ordstillingen.', why: '', ov: {} },
    },
    updatedAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  };
}

function Harness({
  initial,
  onChange,
}: {
  initial: MatchPairs;
  onChange?: (n: MatchPairs) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFeedback
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: MatchPairs) {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup(), onChange };
}

const openMatrix = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('radio', { name: 'Matrix' }));

describe('StepFeedback — by pair', () => {
  it('counts the cells of a pair against the pool minus its own half (AC-B16)', () => {
    renderStep(doc());

    // Pool is 3 answers + 1 extra; a pair explains the three that are not its own.
    expect(screen.getAllByText('0 / 3')).toHaveLength(3);
    expect(screen.getByText('0 of 9 specific explanations written')).toBeInTheDocument();
  });

  it('puts a pair with no default in the error state and says it blocks publishing (AC-B17)', () => {
    renderStep(doc({ feedback: { p2: { def: 'x', why: '', ov: {} } } }));

    expect(screen.getAllByText('Required — this is what most students will read.')).toHaveLength(2);
    expect(
      screen.getByText('2 pairs still have no default explanation — this blocks publishing.'),
    ).toBeInTheDocument();
  });

  it('softens the missing default to a reminder for word pairs (decision 3)', () => {
    renderStep(doc({ variant: 'pairs', feedback: {} }));

    expect(screen.queryByText(/blocks publishing/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        '3 pairs have no default explanation. Word pairs still publish without one.',
      ),
    ).toBeInTheDocument();
  });

  it('counts an override the moment it is typed (AC-B18)', async () => {
    const { user, onChange } = renderStep(doc());

    const row = screen.getAllByLabelText('vi blir hjemme.')[0]!;
    await user.type(row, 'Word order.');

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.feedback['p1']?.ov['h9']).toEqual({ text: 'Word order.', origin: 'author' });
    expect(screen.getByText('1 of 9 specific explanations written')).toBeInTheDocument();
  });

  it('drops an override when its text is cleared rather than storing a blank', async () => {
    const { user, onChange } = renderStep(
      doc({ feedback: { p1: { def: 'a', why: '', ov: { h9: { text: 'x', origin: 'author' } } } } }),
    );

    await user.clear(screen.getAllByLabelText('vi blir hjemme.')[0]!);

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.feedback['p1']?.ov).toEqual({});
  });

  it('hides written rows behind the filter but never the default field (AC-B19)', async () => {
    const { user } = renderStep(
      doc({
        feedback: {
          p1: { def: 'Se på ordstillingen.', why: '', ov: { h9: { text: 'x', origin: 'author' } } },
          p2: { def: 'b', why: '', ov: {} },
          p3: { def: 'c', why: '', ov: {} },
        },
      }),
    );

    expect(screen.getAllByLabelText('vi blir hjemme.')).toHaveLength(3);

    await user.click(screen.getByRole('checkbox', { name: /Only halves without an explanation/ }));

    expect(screen.getAllByLabelText('vi blir hjemme.')).toHaveLength(2);
    expect(screen.getAllByLabelText('If the student picks the wrong half')).toHaveLength(3);
  });

  it('shows the pair default as the placeholder of every empty cell (AC-B22)', () => {
    renderStep(doc());

    expect(screen.getAllByLabelText('vi blir hjemme.')[1]).toHaveAttribute(
      'placeholder',
      'Uses the default: Etter «fordi» står subjektet først.',
    );
  });
});

describe('StepFeedback — matrix', () => {
  it('locks the cell where a pair meets its own half (AC-B20)', async () => {
    const { user } = renderStep(doc());
    await openMatrix(user);

    const table = screen.getByRole('table');
    expect(
      within(table).getByTitle(
        'blir vi hjemme. is the correct half for pair 1. Hvis det regner i morgen,',
      ),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole('button', {
        name: /pair 1\. Hvis det regner i morgen, with the half “blir vi hjemme\.”/,
      }),
    ).not.toBeInTheDocument();
  });

  it('walks every editable cell in order with a counter (AC-B21)', async () => {
    const { user } = renderStep(doc());
    await openMatrix(user);

    await user.click(
      screen.getByRole('button', {
        name: 'Write an explanation for pair 1. Hvis det regner i morgen, with the half “jeg sto opp for sent.”',
      }),
    );

    // 3 pairs × (4 pool halves − its own) = 9 cells.
    expect(screen.getByText('1 / 9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous cell' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next cell' }));
    expect(screen.getByText('2 / 9')).toBeInTheDocument();
  });

  it('opens the cell with the pair default as placeholder and writes into it (AC-B22)', async () => {
    const { user, onChange } = renderStep(doc());
    await openMatrix(user);

    await user.click(
      screen.getByRole('button', {
        name: 'Write an explanation for pair 2. Jeg rakk ikke bussen fordi with the half “vi blir hjemme.”',
      }),
    );

    const field = screen.getByRole('textbox', {
      name: 'Edit the explanation for pair 2. Jeg rakk ikke bussen fordi with the half “vi blir hjemme.”',
    });
    expect(field).toHaveAttribute(
      'placeholder',
      'Uses the default: Etter «fordi» står subjektet først.',
    );
    expect(field).toHaveFocus();

    await user.type(field, 'Nei.');

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.feedback['p2']?.ov['h9']?.text).toBe('Nei.');
  });

  it('turns the cell green once it has text (AC-B18)', async () => {
    const { user } = renderStep(
      doc({
        feedback: {
          p1: { def: 'a', why: '', ov: { h9: { text: 'Word order.', origin: 'author' } } },
        },
      }),
    );
    await openMatrix(user);

    expect(
      screen.getByRole('button', {
        name: 'Edit the explanation for pair 1. Hvis det regner i morgen, with the half “vi blir hjemme.”',
      }),
    ).toBeInTheDocument();
  });

  it('has no serious or critical accessibility violations (AC-X2)', async () => {
    const { container } = render(<Harness initial={doc()} />);
    const user = userEvent.setup();
    await openMatrix(user);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });
});
