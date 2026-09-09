import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUDIO_DEFAULT, type ExerciseAudio } from '@/lib/shared-kernel/audio';
import type { ExerciseAudioEngine } from '@/features/student/exercises/audio';
import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_SETTINGS,
  type ProjectedSettings,
  type StudentProjection,
} from '@/lib/shared-kernel/multiple-choice-group';
import type {
  MultipleChoiceGroupItemResult,
  MultipleChoiceGroupSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import {
  MultipleChoiceGroupBody,
  type MultipleChoiceGroupPhase,
} from './multiple-choice-group-body';

type TableOverrides = Partial<Omit<StudentProjection, 'settings'>> & {
  settings?: Partial<ProjectedSettings>;
};

function makeTable(overrides: TableOverrides = {}): StudentProjection {
  const { settings, ...rest } = overrides;
  return {
    instruction: 'Riktig eller galt?',
    source: { mode: 'inline', label: 'Tekst 1A', text: 'Bartek søker ny jobb.' },
    columns: [
      { id: 'c-r', label: 'Riktig' },
      { id: 'c-g', label: 'Galt' },
    ],
    rows: [
      { id: 'r1', text: 'Bartek er fornøyd med jobben sin.' },
      { id: 'r2', text: 'Bartek har søkt på en ny stilling.' },
    ],
    settings: {
      numbering: DEFAULT_SETTINGS.numbering,
      layout: DEFAULT_SETTINGS.layout,
      retry: DEFAULT_SETTINGS.retry,
      progress: DEFAULT_SETTINGS.progress,
      showText: DEFAULT_SETTINGS.showText,
      passThreshold: DEFAULT_SETTINGS.passThreshold,
      ...settings,
    },
    ...rest,
  };
}

function item(
  itemId: string,
  overrides: Partial<MultipleChoiceGroupItemResult> = {},
): MultipleChoiceGroupItemResult {
  return {
    itemId,
    submitted: 'c-r',
    correct: false,
    firstAnswer: 'c-r',
    ...overrides,
  };
}

function makeVerdict(
  overrides: Partial<MultipleChoiceGroupSubmitDetails> = {},
): MultipleChoiceGroupSubmitDetails {
  return {
    totalItems: 2,
    passedItems: 1,
    attempt: 1,
    attemptsLeft: 1,
    closed: false,
    locked: [],
    items: [item('r1', { correct: true }), item('r2')],
    ...overrides,
  };
}

interface HarnessProps {
  table?: StudentProjection;
  answers?: Record<string, string>;
  phase?: MultipleChoiceGroupPhase;
  verdict?: MultipleChoiceGroupSubmitDetails | null;
  locked?: string[];
  interactive?: boolean;
  sourceHref?: string;
  onPick?: (rowId: string, columnId: string) => void;
  onCheck?: () => void;
  onRetry?: () => void;
  onReveal?: () => void;
  onFinish?: () => void;
  onRestart?: () => void;
  audio?: ExerciseAudioEngine;
}

function Harness({
  table = makeTable(),
  answers = {},
  phase = 'answering',
  verdict = null,
  locked = [],
  interactive = true,
  audio,
  sourceHref,
  onPick = () => {},
  onCheck = () => {},
  onRetry = () => {},
  onReveal = () => {},
  onFinish = () => {},
  onRestart = () => {},
}: HarnessProps): ReactElement {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MultipleChoiceGroupBody
        projection={table}
        answers={answers}
        onPick={onPick}
        phase={phase}
        verdict={verdict}
        locked={locked}
        interactive={interactive}
        {...(audio === undefined ? {} : { audio })}
        {...(sourceHref === undefined ? {} : { sourceHref })}
        onCheck={onCheck}
        onRetry={onRetry}
        onReveal={onReveal}
        onFinish={onFinish}
        onRestart={onRestart}
        accent="#000"
      />
    </NextIntlClientProvider>
  );
}

/**
 * The desktop layout, where the statements are a real table. JSDOM measures every element
 * at 0, which is the cards branch — so the two are told apart here the same way the
 * component tells them apart: by how much room it is given.
 */
function renderWide(ui: ReactElement) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 960,
    height: 600,
    top: 0,
    left: 0,
    right: 960,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return render(ui);
}

const cell = (statement: string, column: string) =>
  screen.getByRole('radio', { name: `${statement} — ${column}` });

const R1 = 'Bartek er fornøyd med jobben sin.';
const R2 = 'Bartek har søkt på en ny stilling.';

afterEach(() => vi.restoreAllMocks());

describe('MultipleChoiceGroupBody — answering', () => {
  it('draws a table with a column per answer column when there is room', () => {
    renderWide(<Harness />);

    expect(screen.getByRole('columnheader', { name: 'Statement' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Riktig' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Bartek er fornøyd/ })).toBeInTheDocument();
  });

  it('draws one card per statement when there is not', () => {
    render(<Harness />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: R1 })).toBeInTheDocument();
  });

  it('holds `Check the answers` shut until every statement is answered, with a counter', () => {
    const { rerender } = renderWide(<Harness answers={{ r1: 'c-r' }} />);

    expect(screen.getByRole('button', { name: 'Check the answers' })).toBeDisabled();
    expect(screen.getByText('1 left')).toBeInTheDocument();

    rerender(<Harness answers={{ r1: 'c-r', r2: 'c-g' }} />);
    expect(screen.getByRole('button', { name: 'Check the answers' })).toBeEnabled();
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });

  it('reports the pick with its row and column, one column per row', async () => {
    const onPick = vi.fn();
    renderWide(<Harness answers={{ r1: 'c-r' }} onPick={onPick} />);

    expect(cell(R1, 'Riktig')).toHaveAttribute('aria-checked', 'true');
    expect(cell(R1, 'Galt')).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(cell(R1, 'Galt'));
    expect(onPick).toHaveBeenCalledWith('r1', 'c-g');
  });

  it('takes no input at all in a static preview', () => {
    renderWide(<Harness answers={{ r1: 'c-r', r2: 'c-g' }} interactive={false} />);

    expect(cell(R1, 'Riktig')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check the answers' })).toBeDisabled();
  });

  it('keeps a frozen row frozen while the rest of the table is still open', () => {
    renderWide(<Harness answers={{ r1: 'c-r' }} locked={['r1']} />);

    expect(cell(R1, 'Galt')).toBeDisabled();
    expect(cell(R2, 'Galt')).toBeEnabled();
  });

  it('shows the passage the server sent, and nothing when it withheld one', () => {
    const { rerender } = renderWide(<Harness />);
    expect(screen.getByText('Bartek søker ny jobb.')).toBeInTheDocument();

    rerender(<Harness table={makeTable({ source: { mode: 'inline', label: 'Tekst 1A' } })} />);
    expect(screen.queryByText('Bartek søker ny jobb.')).not.toBeInTheDocument();
  });

  it('offers the way back to the lesson when the page said where it is', () => {
    renderWide(
      <Harness
        table={makeTable({ source: { mode: 'link', label: 'Tekst 1A' } })}
        sourceHref="/en/student/courses/c1/u1/i1"
      />,
    );

    const link = screen.getByRole('link', { name: 'Go to the text: Tekst 1A' });
    expect(link).toHaveAttribute('href', '/en/student/courses/c1/u1/i1');
  });

  it('falls back to the generic wording when the author left the link unlabelled', () => {
    renderWide(
      <Harness
        table={makeTable({ source: { mode: 'link', label: '' } })}
        sourceHref="/en/student/courses/c1/u1/i1"
      />,
    );

    expect(screen.getByRole('link', { name: 'Go to the text' })).toBeInTheDocument();
  });

  it('says nothing at all about a link it has nowhere to point', () => {
    renderWide(<Harness table={makeTable({ source: { mode: 'link', label: 'Tekst 1A' } })} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Tekst 1A')).not.toBeInTheDocument();
  });

  it('has an empty state when the table has no deliverable statements', () => {
    renderWide(<Harness table={makeTable({ rows: [] })} />);

    expect(screen.getByText('Nothing to answer yet')).toBeInTheDocument();
  });
});

describe('MultipleChoiceGroupBody — checked', () => {
  const checked = (overrides: Partial<MultipleChoiceGroupSubmitDetails> = {}) => (
    <Harness
      answers={{ r1: 'c-r', r2: 'c-r' }}
      phase="checked"
      verdict={makeVerdict(overrides)}
      locked={overrides.locked ?? []}
    />
  );

  it('marks each row from the verdict and never from a key of its own', () => {
    renderWide(checked());

    // Nothing on this screen knows which column is right: with the table still open the
    // server sends no `keyColumnId`, so the unpicked cell stays plain.
    expect(cell(R1, 'Riktig')).toHaveAttribute('aria-checked', 'true');
    expect(cell(R2, 'Galt')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('1 statement is wrong')).toBeInTheDocument();
  });

  it('disables every cell until the learner chooses to try again', () => {
    renderWide(checked());

    expect(cell(R1, 'Galt')).toBeDisabled();
    expect(cell(R2, 'Galt')).toBeDisabled();
  });

  it('offers the retry and the reveal while the table is open, and neither once it closes', async () => {
    const onRetry = vi.fn();
    const onReveal = vi.fn();
    const { rerender } = renderWide(
      <Harness
        answers={{ r1: 'c-r', r2: 'c-r' }}
        phase="checked"
        verdict={makeVerdict()}
        onRetry={onRetry}
        onReveal={onReveal}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try the wrong ones again' }));
    expect(onRetry).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Show the answers' }));
    expect(onReveal).toHaveBeenCalled();

    rerender(
      <Harness
        answers={{ r1: 'c-r', r2: 'c-r' }}
        phase="checked"
        verdict={makeVerdict({ closed: true })}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Try the wrong ones again' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show the answers' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('draws the key only where the server marked one', () => {
    renderWide(
      checked({
        closed: true,
        items: [item('r1', { correct: true }), item('r2', { keyColumnId: 'c-g' })],
      }),
    );

    // A dashed circle on the right column of the missed row — and the row that was right
    // gets no key mark, because there is nothing to correct there.
    expect(cell(R2, 'Galt').getAttribute('style')).toContain('dashed');
    expect(cell(R1, 'Galt').getAttribute('style')).not.toContain('dashed');
  });

  it('states the outcome in words as well as colour', () => {
    const { rerender } = renderWide(
      checked({
        closed: true,
        passedItems: 2,
        items: [item('r1', { correct: true }), item('r2', { correct: true })],
      }),
    );
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('100% right — 70% is required.')).toBeInTheDocument();

    rerender(checked({ closed: true }));
    expect(screen.getByText('Not passed')).toBeInTheDocument();
    expect(screen.getByText('50% right — 70% is required.')).toBeInTheDocument();
  });

  it('shows the attempt counter only while a check stands', () => {
    const { rerender } = renderWide(checked({ attempt: 2 }));
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();

    rerender(<Harness answers={{ r1: 'c-r', r2: 'c-r' }} />);
    expect(screen.queryByText(/Attempt/)).not.toBeInTheDocument();
  });
});

describe('MultipleChoiceGroupBody — explanations', () => {
  it("renders the author's line and the quote that proves it", () => {
    renderWide(
      <Harness
        answers={{ r1: 'c-r', r2: 'c-r' }}
        phase="checked"
        verdict={makeVerdict({
          items: [
            item('r1', { correct: true }),
            item('r2', { why: 'Han vil bytte jobb.', quote: 'søker ny jobb' }),
          ],
        })}
      />,
    );

    expect(screen.getByText('Han vil bytte jobb.')).toBeInTheDocument();
    expect(screen.getByText('«søker ny jobb»')).toBeInTheDocument();
  });

  it('renders no explanation block for a row the server sent neither field for', () => {
    // The author wrote nothing for this statement, so nothing is drawn — whatever
    // `showWhy` was set to. The server simply does not send the fields.
    renderWide(
      <Harness
        answers={{ r1: 'c-r', r2: 'c-r' }}
        phase="checked"
        verdict={makeVerdict({ items: [item('r1', { correct: true }), item('r2')] })}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + two statements
  });
});

describe('MultipleChoiceGroupBody — done', () => {
  it('reports the score of the closed table and offers a fresh attempt', async () => {
    const onFinish = vi.fn();
    const { rerender } = renderWide(
      <Harness
        answers={{ r1: 'c-r', r2: 'c-r' }}
        phase="checked"
        verdict={makeVerdict({ closed: true })}
        onFinish={onFinish}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onFinish).toHaveBeenCalled();

    rerender(
      <Harness
        answers={{ r1: 'c-r', r2: 'c-r' }}
        phase="done"
        verdict={makeVerdict({ closed: true })}
      />,
    );
    expect(screen.getByText('1 of 2 right.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
  });

  /*
    The listening layer on this type (plan 56 phase 5). Timecodes per row are its high-value
    case — a table of statements about one dialogue, each with its own line to hear — and
    the gate has to reach the cells, which are the only inputs this type owns.
  */
  describe('with audio', () => {
    const audioBlock = (over: Record<string, unknown> = {}): ExerciseAudio => ({
      ...AUDIO_DEFAULT,
      enabled: true,
      assetId: 'asset-1',
      title: 'Dialog',
      duration: 96,
      ...over,
      settings: { ...AUDIO_DEFAULT.settings, ...((over['settings'] as object) ?? {}) },
    });

    const engine = (over: Partial<ExerciseAudioEngine> = {}): ExerciseAudioEngine => ({
      audio: audioBlock(),
      segments: {},
      element: null,
      src: 'https://cdn.test/asset-1.mp3',
      state: { pos: 0, playing: false, plays: 0, completed: 0, range: null },
      duration: 96,
      playing: false,
      plays: 0,
      limit: 0,
      exhausted: false,
      heard: false,
      gated: false,
      canPlay: true,
      failed: false,
      loading: false,
      speed: 1,
      toggle: vi.fn(),
      back: vi.fn(),
      seekTo: vi.fn(),
      playRange: vi.fn(),
      cycleSpeed: vi.fn(),
      reset: vi.fn(),
      ...over,
    });

    it('puts a player above the table and leaves the table itself alone', () => {
      renderWide(<Harness audio={engine()} />);

      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
      expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
    });

    it('locks the cells and the check button until the clip has been heard', () => {
      renderWide(<Harness audio={engine({ gated: true })} />);

      for (const cell of screen.getAllByRole('radio')) expect(cell).toBeDisabled();
      expect(screen.getByRole('button', { name: /Check/ })).toBeDisabled();
      expect(
        screen.getByText('The statements open once you have heard the clip through once.'),
      ).toBeInTheDocument();
    });

    it('is not there at all for a table without it', () => {
      renderWide(<Harness />);

      expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
      for (const cell of screen.getAllByRole('radio')) expect(cell).toBeEnabled();
    });
  });

});
