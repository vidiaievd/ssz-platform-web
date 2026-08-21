import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type MatchPairs, type Variant } from '@/lib/shared-kernel/match-pairs';

import { StepPairs } from './step-pairs';

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
    distractors: [],
    feedback: {},
    updatedAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  };
}

/** Drives the controlled component the way the shell will, so edits accumulate. */
function Harness({
  initial,
  variantChosen = true,
  onChange,
  onVariantChosen,
}: {
  initial: MatchPairs;
  variantChosen?: boolean;
  onChange?: (next: MatchPairs) => void;
  onVariantChosen?: (variant: Variant) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  const [chosen, setChosen] = useState(variantChosen);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepPairs
        exercise={exercise}
        variantChosen={chosen}
        onVariantChosen={(variant) => {
          onVariantChosen?.(variant);
          setChosen(true);
        }}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: MatchPairs, variantChosen = true) {
  const onChange = vi.fn();
  const onVariantChosen = vi.fn();
  render(
    <Harness
      initial={initial}
      variantChosen={variantChosen}
      onChange={onChange}
      onVariantChosen={onVariantChosen}
    />,
  );
  return { user: userEvent.setup(), onChange, onVariantChosen };
}

const leftOf = (index: number) => screen.getAllByLabelText('LEFT')[index]!;
const rightOf = (index: number) => screen.getAllByLabelText('RIGHT · ANSWER')[index]!;

describe('StepPairs', () => {
  it('writes both halves of one pair and counts it as complete (AC-B1)', async () => {
    const { user } = renderStep(doc({ pairs: [{ id: 'p1', rightId: 'h1', left: '', right: '' }] }));

    await user.type(leftOf(0), 'Hvis det regner i morgen,');
    await user.type(rightOf(0), 'blir vi hjemme.');

    expect(leftOf(0)).toHaveValue('Hvis det regner i morgen,');
    expect(rightOf(0)).toHaveValue('blir vi hjemme.');
    expect(screen.getByText('1 complete pair')).toBeInTheDocument();
  });

  it('flags a pair with one half filled, and says nothing about an empty one (AC-B2)', async () => {
    renderStep(
      doc({
        pairs: [
          { id: 'p1', rightId: 'h1', left: 'Hvis det regner i morgen,', right: '' },
          { id: 'p2', rightId: 'h2', left: '', right: '' },
        ],
      }),
    );

    expect(screen.getAllByText('One half is empty')).toHaveLength(1);
    expect(rightOf(0)).toHaveAttribute('aria-invalid', 'true');
    expect(rightOf(1)).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('deletes a pair and takes the overrides pointing at its half with it (AC-B4)', async () => {
    const { user, onChange } = renderStep(
      doc({
        feedback: {
          p1: { def: 'a', why: '', ov: {} },
          p2: { def: 'b', why: '', ov: { h1: { text: 'about the first half', origin: 'author' } } },
        },
      }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Delete pair' })[0]!);

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.pairs.map((pair) => pair.id)).toEqual(['p2', 'p3']);
    expect(next.feedback['p1']).toBeUndefined();
    expect(next.feedback['p2']?.ov['h1']).toBeUndefined();
  });

  it('refuses to delete the last pair (AC-B5)', () => {
    renderStep(doc({ pairs: [{ id: 'p1', rightId: 'h1', left: 'Hun sa at', right: 'hun kom.' }] }));

    expect(screen.getByRole('button', { name: 'Delete pair' })).toBeDisabled();
  });

  it('adds two pairs from a pasted list and flags a line with no right half (AC-B6)', async () => {
    const { user } = renderStep(doc({ pairs: [{ id: 'p1', rightId: 'h1', left: '', right: '' }] }));

    await user.click(screen.getByRole('button', { name: 'Paste a list' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Paste a list of pairs' }),
      'Hvis det regner, | blir vi hjemme.{enter}Hun sa at hun kom.',
    );

    expect(screen.getByText('no right half')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add 2 pairs' }));

    // The blank card was replaced, not kept above the pasted work (AC-B7).
    expect(screen.getAllByLabelText('LEFT')).toHaveLength(2);
    expect(leftOf(0)).toHaveValue('Hvis det regner,');
    expect(rightOf(1)).toHaveValue('');
  });

  it('puts focus in the LEFT half of a pair just added (AC-B8)', async () => {
    const { user } = renderStep(doc());

    await user.click(screen.getByRole('button', { name: 'Add a pair' }));

    expect(screen.getAllByLabelText('LEFT')).toHaveLength(4);
    expect(leftOf(3)).toHaveFocus();
  });

  it('moves focus to the next card after a delete', async () => {
    const { user } = renderStep(doc());

    await user.click(screen.getAllByRole('button', { name: 'Delete pair' })[0]!);

    expect(leftOf(0)).toHaveValue('Jeg rakk ikke bussen fordi');
    expect(leftOf(0)).toHaveFocus();
  });

  it('reports fewer than three complete pairs as a blocker (AC-B9)', () => {
    renderStep(
      doc({
        pairs: [
          { id: 'p1', rightId: 'h1', left: 'Hun sa at', right: 'hun kom.' },
          { id: 'p2', rightId: 'h2', left: 'Jeg tror', right: 'det går bra.' },
        ],
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Write at least 3 complete pairs — 2 so far.',
    );
  });

  it('leaves the variant unchosen until the teacher says which kind this is', async () => {
    const { user, onVariantChosen, onChange } = renderStep(doc(), false);

    const segment = screen.getByRole('radiogroup', { name: 'What kind of pairs is this?' });
    expect(within(segment).getByRole('radio', { name: 'Sentence halves' })).not.toBeChecked();
    expect(within(segment).getByRole('radio', { name: 'Word ↔ translation' })).not.toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose which kind this is — the two are graded by different rules.',
    );

    await user.click(within(segment).getByRole('radio', { name: 'Word ↔ translation' }));

    expect(onVariantChosen).toHaveBeenCalledWith('pairs');
    expect((onChange.mock.calls.at(-1)![0] as MatchPairs).variant).toBe('pairs');
    expect(screen.queryByText(/Choose which kind this is/)).not.toBeInTheDocument();
  });

  it('warns inline about a duplicated left half and an overlong right half (§1.6)', () => {
    renderStep(
      doc({
        pairs: [
          { id: 'p1', rightId: 'h1', left: 'Hun sa at', right: 'hun kom.' },
          { id: 'p2', rightId: 'h2', left: 'hun sa at', right: 'hun ikke kom.' },
          {
            id: 'p3',
            rightId: 'h3',
            left: 'Jeg tror',
            right: 'at det kommer til å gå helt fint med oss alle sammen i morgen tidlig uansett.',
          },
        ],
      }),
    );

    expect(screen.getByText('Another pair starts with the same words.')).toBeInTheDocument();
    expect(
      screen.getByText('16 words — this half reads badly in a chip on a phone.'),
    ).toBeInTheDocument();
  });

  it('stores the why note with the pair explanations', async () => {
    const { user, onChange } = renderStep(doc());

    await user.type(
      screen.getByLabelText('Why the right half of pair 1 is the right one'),
      'Inversjon.',
    );

    const next = onChange.mock.calls.at(-1)![0] as MatchPairs;
    expect(next.feedback['p1']?.why).toBe('Inversjon.');
  });

  it('offers the empty state instead of a bare list when nothing is written', () => {
    renderStep(doc({ pairs: [] }));

    expect(screen.getByText('No pairs yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a pair' })).toBeInTheDocument();
  });

  // Colour contrast is off: jsdom has no layout, so axe cannot compute it, and the
  // palette is the shared token set the rest of the product is checked against.
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
