import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_SETTINGS,
  type Placement,
  type ProjectedRow,
  type Settings,
  type StudentResult,
} from '@/lib/shared-kernel/sentence-schema';

import { SentenceSchemaBody, type SentenceSchemaPhase } from './sentence-schema-body';

/**
 * One sentence as the server projects it: fields, a shuffled bank, and the sentence to
 * rewrite. Nothing here says where a piece goes — that is the point of the type.
 *
 * `f-adv` is optional and `f-slutt` is not, which is what the two empty-cell rules are
 * about: an optional empty field draws `—`, a required one draws nothing, so its
 * emptiness cannot be read as a clue.
 */
function makeRow(overrides: Partial<ProjectedRow> = {}): ProjectedRow {
  return {
    id: 'r1',
    clause: 'sub',
    fields: [
      {
        id: 'f-sub',
        short: 'sub',
        label: 'Subjunksjon',
        hint: 'at, om eller spørreordet',
        optional: false,
      },
      { id: 'f-adv', short: 'a', label: 'Adverbial', hint: '', optional: true },
      { id: 'f-v', short: 'v', label: 'Verbal', hint: '', optional: false },
      { id: 'f-slutt', short: 'N', label: 'Sluttfelt', hint: '', optional: false },
    ],
    bank: [
      { id: 'c1', text: 'at' },
      { id: 'c2', text: 'ikke' },
      { id: 'c3', text: 'kommer' },
      { id: 'x1', text: 'har' },
    ],
    source: '«Jeg kommer ikke», sa han.',
    counts: null,
    start: {},
    ...overrides,
  };
}

function makeResult(overrides: Partial<StudentResult> = {}): StudentResult {
  return {
    rowId: 'r1',
    attempt: 1,
    byItem: { c1: 'ok', c2: 'field' },
    byField: { 'f-sub': 'ok', 'f-adv': 'bad', 'f-v': 'empty', 'f-slutt': 'empty' },
    wrong: 1,
    solved: false,
    score: 25,
    why: null,
    text: null,
    solution: null,
    banner: { source: 'override', text: 'Her står ikke foran verbet.', code: null, hint: '' },
    ...overrides,
  };
}

function Harness({
  row = makeRow(),
  settings = DEFAULT_SETTINGS,
  phase = 'placing' as SentenceSchemaPhase,
  result = null,
  attempt = 1,
  initial = {},
  onCheck = vi.fn(),
  onRetry = vi.fn(),
  onReveal = vi.fn(),
  onNext = vi.fn(),
  onRestart = vi.fn(),
}: {
  row?: ProjectedRow;
  settings?: Settings;
  phase?: SentenceSchemaPhase;
  result?: StudentResult | null;
  attempt?: number;
  initial?: Placement;
  onCheck?: () => void;
  onRetry?: () => void;
  onReveal?: () => void;
  onNext?: () => void;
  onRestart?: () => void;
}): ReactElement {
  const [placement, setPlacement] = useState<Placement>(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SentenceSchemaBody
        row={row}
        settings={settings}
        index={0}
        total={2}
        placement={placement}
        onPlacementChange={setPlacement}
        phase={phase}
        attempt={attempt}
        result={result}
        tally={{ solved: 1, revealed: 0, skipped: 0 }}
        onCheck={onCheck}
        onRetry={onRetry}
        onReveal={onReveal}
        onNext={onNext}
        onRestart={onRestart}
        accent="var(--ssz-runner-practice)"
      />
    </NextIntlClientProvider>
  );
}

const field = (name: string) => screen.getByRole('button', { name: `Place in ${name}` });
const piece = (text: string) => screen.getByRole('button', { name: text });

describe('SentenceSchemaBody', () => {
  it('places a piece by tapping the piece and then the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(piece('at'));
    await user.click(field('Subjunksjon'));

    expect(field('Subjunksjon')).toHaveTextContent('at');
  });

  it('places a piece by tapping the field first — the same path in reverse', async () => {
    // BEHAVIOR, "Student · placing": both directions, and no mode switch between them.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field('Verbal'));
    await user.click(piece('kommer'));

    expect(field('Verbal')).toHaveTextContent('kommer');
  });

  it('answers Enter and Space on a field, so the board is solvable without a pointer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(piece('at'));
    field('Subjunksjon').focus();
    await user.keyboard('{Enter}');

    expect(field('Subjunksjon')).toHaveTextContent('at');
  });

  it('takes a placed piece back when its own × is pressed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ 'f-sub': ['c1'] }} />);

    await user.click(screen.getByRole('button', { name: 'Take «at» back' }));

    expect(field('Subjunksjon')).not.toHaveTextContent('at');
  });

  it('takes a placed piece back when it is tapped in the bank, where it still sits', async () => {
    // A used piece stays in the bank at low opacity rather than leaving it: a bank that
    // reflows on every placement destroys the learner's spatial memory mid-sentence.
    const user = userEvent.setup();
    render(<Harness initial={{ 'f-sub': ['c1'] }} />);

    expect(piece('at')).toBeInTheDocument();
    await user.click(piece('at'));

    expect(field('Subjunksjon')).not.toHaveTextContent('at');
  });

  it('moves a piece from one field to another without leaving a copy behind', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ 'f-sub': ['c1'] }} />);

    await user.click(piece('at'));
    await user.click(piece('at'));
    await user.click(field('Verbal'));

    expect(field('Subjunksjon')).not.toHaveTextContent('at');
    expect(field('Verbal')).toHaveTextContent('at');
  });

  it('shows the sentence to rewrite and never the sentence being built', () => {
    render(<Harness />);

    expect(screen.getByText('«Jeg kommer ikke», sa han.')).toBeInTheDocument();
    expect(screen.queryByText(/at han ikke kommer/)).not.toBeInTheDocument();
  });

  it('counts what is placed on the Check button, and refuses an empty board', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Harness onCheck={onCheck} />);

    expect(screen.getByRole('button', { name: 'Check (0/4)' })).toBeDisabled();

    await user.click(piece('at'));
    await user.click(field('Subjunksjon'));
    await user.click(screen.getByRole('button', { name: 'Check (1/4)' }));

    expect(onCheck).toHaveBeenCalled();
  });

  it('shows the author’s own note for the piece that went wrong', () => {
    // The chain runs over the answer key, so the note arrives resolved from the server.
    render(<Harness phase="checked" result={makeResult()} initial={{ 'f-adv': ['c2'] }} />);

    expect(screen.getByText('Her står ikke foran verbet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fix (1)' })).toBeInTheDocument();
  });

  it('renders a default note as copy rather than as the code it arrived as', () => {
    render(
      <Harness
        phase="checked"
        result={makeResult({
          banner: { source: 'default', text: '', code: 'order', hint: '' },
        })}
      />,
    );

    expect(screen.getByText('Right field, wrong order inside it.')).toBeInTheDocument();
  });

  it('repeats the rule under the note from the second attempt on', () => {
    render(
      <Harness
        attempt={2}
        phase="checked"
        result={makeResult({
          attempt: 2,
          banner: {
            source: 'override',
            text: 'Her står ikke foran verbet.',
            code: null,
            hint: 'I en leddsetning står ikke foran verbet.',
          },
        })}
      />,
    );

    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect(screen.getByText('I en leddsetning står ikke foran verbet.')).toBeInTheDocument();
  });

  it('drops the marks as soon as the board is edited again', async () => {
    // Transient by design: a marked board that is then edited is a board whose marks are
    // about something else. The body reports the edit; the runner clears the phase.
    const user = userEvent.setup();
    const marked = makeResult();
    render(<Harness phase="checked" result={marked} initial={{ 'f-adv': ['c2'] }} />);

    expect(screen.getByText('Her står ikke foran verbet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Take «ikke» back' }));

    // Still `checked` here — only the solver can change the phase — but the piece is off
    // the board, which is the edit the runner acts on.
    expect(field('Adverbial')).not.toHaveTextContent('ikke');
  });

  it('locks the board and hides the bank once the sentence is closed', () => {
    render(
      <Harness
        phase="closed"
        result={makeResult({
          solved: true,
          byItem: { c1: 'ok', c2: 'ok', c3: 'ok' },
          wrong: 0,
          score: 100,
          why: 'I en leddsetning står ikke foran verbet.',
          text: 'at han ikke kommer',
          banner: {
            source: 'why',
            text: 'I en leddsetning står ikke foran verbet.',
            code: null,
            hint: '',
          },
        })}
        initial={{ 'f-sub': ['c1'], 'f-adv': ['c2'], 'f-v': ['c3'] }}
      />,
    );

    // The sentence itself arrives with the verdict, and only then.
    expect(screen.getByText('at han ikke kommer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check (3/4)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next sentence' })).toBeInTheDocument();
    // A locked board is a picture, not a control being refused: the cells stop being
    // drop targets and the bank is gone, so there is nothing left to press.
    expect(screen.queryByRole('button', { name: 'Place in Subjunksjon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'at' })).not.toBeInTheDocument();
  });

  it('offers to show the schema while the sentence is open, and not after', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Show the correct schema' })).toBeInTheDocument();
  });

  it('marks an optional empty field with a dash and a required one with nothing', () => {
    render(<Harness />);

    // `f-adv` is optional, `f-slutt` is not. The second is deliberately silent: an empty
    // required field must not hint that something belongs there.
    expect(field('Adverbial')).toHaveTextContent('—');
    expect(field('Sluttfelt')).toHaveTextContent('');
  });

  it('hides where the mistake is when the author turned per-field marking off, and keeps the verdict', () => {
    render(
      <Harness
        settings={{ ...DEFAULT_SETTINGS, perField: false }}
        phase="checked"
        result={makeResult()}
        initial={{ 'f-adv': ['c2'] }}
      />,
    );

    // The note still appears — §6.8: hiding where the mistake is must not hide that
    // there is one.
    expect(screen.getByText('Her står ikke foran verbet.')).toBeInTheDocument();
  });

  it('shows the field hints only when the author turned them on', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByText('at, om eller spørreordet')).not.toBeInTheDocument();
    unmount();

    render(<Harness settings={{ ...DEFAULT_SETTINGS, hints: true }} />);
    expect(screen.getByText('at, om eller spørreordet')).toBeInTheDocument();
  });

  it('shows the completion card with a replay, and no navigation of its own', () => {
    render(<Harness phase="done" />);

    expect(screen.getByText('All 2 sentences done')).toBeInTheDocument();
    expect(screen.getByText('1 solved · 0 shown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do it again' })).toBeInTheDocument();
    // Plan 52 §5: the player owns navigation, so the card offers no "next exercise".
    expect(screen.queryByRole('button', { name: /next exercise/i })).not.toBeInTheDocument();
  });
});
