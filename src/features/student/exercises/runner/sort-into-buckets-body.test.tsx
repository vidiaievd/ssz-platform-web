import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ProjectedSettings, StudentProjection } from '@/lib/shared-kernel/sort-into-buckets';
import type {
  SortIntoBucketsItemResult,
  SortIntoBucketsSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import {
  SortIntoBucketsBody,
  type SortIntoBucketsPhase,
  type SortIntoBucketsPlacements,
} from './sort-into-buckets-body';

function makeBoard(settings: Partial<ProjectedSettings> = {}): StudentProjection {
  return {
    instruction: '',
    buckets: [
      { id: 'b-en', label: 'en' },
      { id: 'b-ei', label: 'ei' },
    ],
    items: [
      { id: 'i1', text: 'bok' },
      { id: 'i2', text: 'bil' },
      { id: 'i3', text: 'sol' },
    ],
    settings: { showRemaining: false, revealKey: true, attempts: 0, threshold: 70, ...settings },
  };
}

function result(itemId: string, overrides: Partial<SortIntoBucketsItemResult> = {}) {
  return {
    itemId,
    chosenBucketId: null,
    correct: false,
    firstCorrect: false,
    firstAnswer: null,
    ...overrides,
  } satisfies SortIntoBucketsItemResult;
}

function makeVerdict(
  overrides: Partial<SortIntoBucketsSubmitDetails> = {},
): SortIntoBucketsSubmitDetails {
  return {
    totalItems: 3,
    passedItems: 1,
    correctNow: 1,
    attempt: 1,
    checksLeft: null,
    closed: false,
    revealed: false,
    locked: ['i2'],
    rules: [],
    items: [
      result('i1', { chosenBucketId: 'b-en', explanation: 'bok is feminine here.' }),
      result('i2', { chosenBucketId: 'b-en', correct: true, firstCorrect: true }),
      result('i3'),
    ],
    ...overrides,
  };
}

interface HarnessProps {
  board?: StudentProjection;
  initial?: SortIntoBucketsPlacements;
  phase?: SortIntoBucketsPhase;
  verdict?: SortIntoBucketsSubmitDetails | null;
  locked?: string[];
  attempt?: number;
  interactive?: boolean;
  onCheck?: () => void;
  onRetry?: () => void;
  onReveal?: () => void;
  onFinish?: () => void;
}

/** Holds the placements the way the solver does, so a tap actually moves a tile. */
function Harness({
  board = makeBoard(),
  initial = {},
  phase = 'answering',
  verdict = null,
  locked = [],
  attempt = 1,
  interactive = true,
  onCheck = () => {},
  onRetry = () => {},
  onReveal = () => {},
  onFinish = () => {},
}: HarnessProps): ReactElement {
  const [placements, setPlacements] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SortIntoBucketsBody
        projection={board}
        placements={placements}
        onPlace={(itemId, bucketId) =>
          setPlacements((current) => {
            const next = { ...current };
            if (bucketId === null) delete next[itemId];
            else next[itemId] = bucketId;
            return next;
          })
        }
        phase={phase}
        verdict={verdict}
        locked={locked}
        attempt={attempt}
        interactive={interactive}
        onCheck={onCheck}
        onRetry={onRetry}
        onReveal={onReveal}
        onFinish={onFinish}
        accent="#000"
      />
    </NextIntlClientProvider>
  );
}

/** JSDOM measures every box at 0 — the narrow branch. Wide is asked for by lending room. */
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

const zone = (label: string) => screen.getByRole('group', { name: new RegExp(`^${label},`) });
const tile = (name: string | RegExp) => screen.getByRole('button', { name });

afterEach(() => vi.restoreAllMocks());

describe('SortIntoBucketsBody — placing tiles', () => {
  it('moves a tile into a zone by tap, tap (AC-S1)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(tile('bok'));
    expect(tile('bok')).toHaveAttribute('aria-pressed', 'true');

    await user.click(zone('en'));
    expect(within(zone('en')).getByText('bok')).toBeInTheDocument();
    expect(zone('en')).toHaveAccessibleName('en, 1 item');
  });

  it('moves a tile by keyboard: Enter picks up, Enter on a zone puts down, Escape lets go (AC-S1)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    tile('bok').focus();
    await user.keyboard('{Enter}');
    expect(tile('bok')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(tile('bok')).toHaveAttribute('aria-pressed', 'false');

    await user.keyboard('{Enter}');
    zone('ei').focus();
    await user.keyboard('{Enter}');
    expect(within(zone('ei')).getByText('bok')).toBeInTheDocument();
  });

  it('moves a tile by drag and drop (AC-S1)', () => {
    render(<Harness />);
    const data: Record<string, string> = {};
    const dataTransfer = {
      setData: (type: string, value: string) => (data[type] = value),
      getData: (type: string) => data[type] ?? '',
      effectAllowed: '',
    };

    fireEvent.dragStart(tile('bil'), { dataTransfer });
    fireEvent.dragOver(zone('ei'), { dataTransfer });
    fireEvent.drop(zone('ei'), { dataTransfer });

    expect(within(zone('ei')).getByText('bil')).toBeInTheDocument();
  });

  it('moves a tile from one zone to another by drag, in one gesture', () => {
    render(<Harness initial={{ i1: 'b-en' }} />);
    const data: Record<string, string> = {};
    const dataTransfer = {
      setData: (type: string, value: string) => (data[type] = value),
      getData: (type: string) => data[type] ?? '',
      effectAllowed: '',
    };

    fireEvent.dragStart(within(zone('en')).getByRole('button'), { dataTransfer });
    fireEvent.drop(zone('ei'), { dataTransfer });

    expect(within(zone('ei')).getByText('bok')).toBeInTheDocument();
    expect(within(zone('en')).queryByText('bok')).not.toBeInTheDocument();
  });

  it('returns a placed tile to the pool when tapped with nothing selected (AC-S2)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ i1: 'b-en' }} />);

    await user.click(within(zone('en')).getByRole('button'));

    expect(within(zone('en')).queryByText('bok')).not.toBeInTheDocument();
    expect(tile('bok')).toHaveAttribute('aria-pressed', 'false');
  });

  it('refuses every gesture when the body is a preview', async () => {
    const user = userEvent.setup();
    render(<Harness interactive={false} initial={{ i1: 'b-en' }} />);

    await user.click(within(zone('en')).getByRole('button'));
    expect(within(zone('en')).getByText('bok')).toBeInTheDocument();
  });
});

describe('SortIntoBucketsBody — the check button', () => {
  it('is disabled with nothing placed and counts the unchecked tiles once there are some (AC-S3)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();

    await user.click(tile('bok'));
    await user.click(zone('en'));
    expect(screen.getByRole('button', { name: 'Check (1)' })).toBeEnabled();
  });

  it('comes back, secondary, when a further tile is placed after a check (AC-S3)', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ i1: 'b-en', i2: 'b-en' }}
        phase="checked"
        verdict={makeVerdict()}
        locked={['i2']}
      />,
    );
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();

    await user.click(tile('sol'));
    await user.click(zone('ei'));
    expect(screen.getByRole('button', { name: 'Check (1)' })).toBeEnabled();
  });
});

describe('SortIntoBucketsBody — after a check', () => {
  const checked = (extra: HarnessProps = {}) => (
    <Harness
      initial={{ i1: 'b-en', i2: 'b-en' }}
      phase="checked"
      verdict={makeVerdict()}
      locked={['i2']}
      attempt={1}
      {...extra}
    />
  );

  it('locks the right tile, marks the wrong one and explains it under its zone (AC-S4)', () => {
    render(checked());

    expect(within(zone('en')).getByRole('button', { name: 'bil, in en, correct' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      within(zone('en')).getByRole('button', { name: 'bok, in en, wrong' }),
    ).toBeInTheDocument();
    // Prefixed by the tile's own text, as ordinary text rather than a tooltip.
    expect(within(zone('en')).getByText('bok is feminine here.', { exact: false })).toBeVisible();
  });

  it('does not let a locked or wrong tile move (AC-S4)', async () => {
    const user = userEvent.setup();
    render(checked());

    await user.click(within(zone('en')).getByRole('button', { name: 'bil, in en, correct' }));
    await user.click(within(zone('en')).getByRole('button', { name: 'bok, in en, wrong' }));

    // Neither went back to the pool: both are still in `en`, and the pool holds only `sol`.
    expect(within(zone('en')).getAllByRole('button')).toHaveLength(2);
  });

  it('offers a retry that counts exactly the wrong placed tiles, and fires it (AC-S5)', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(checked({ onRetry }));

    // `sol` was left in the pool: unanswered is not a tile to bring back.
    await user.click(screen.getByRole('button', { name: 'Try the wrong ones again (1)' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says which attempt this is, of how many, and how many are right', () => {
    render(checked({ board: makeBoard({ attempts: 3 }) }));
    expect(screen.getByText('Attempt 1 of 3 · 1 of 3 right')).toBeInTheDocument();
  });

  it('keeps the freeze after a retry, when the verdict is gone (plan 54)', () => {
    render(
      <Harness
        initial={{ i2: 'b-en' }}
        phase="answering"
        verdict={null}
        locked={['i2']}
        attempt={2}
      />,
    );
    expect(screen.getByRole('button', { name: 'bil, in en, correct' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Attempt 2 · 1 of 3 right')).toBeInTheDocument();
  });

  it('removes the retry and the reveal once the board is closed, and offers to finish (AC-S6)', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(checked({ verdict: makeVerdict({ closed: true, checksLeft: 0 }), onFinish }));

    expect(screen.queryByRole('button', { name: /Try the wrong/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show the correct placement' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('offers the reveal while the board is open, and only when the author allows it', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    const { unmount } = render(checked({ onReveal }));
    await user.click(screen.getByRole('button', { name: 'Show the correct placement' }));
    expect(onReveal).toHaveBeenCalledOnce();
    unmount();

    render(checked({ board: makeBoard({ revealKey: false }) }));
    expect(
      screen.queryByRole('button', { name: 'Show the correct placement' }),
    ).not.toBeInTheDocument();
  });

  it('puts every tile where it belongs, with each rule and each why, once the key arrives (AC-S8)', () => {
    render(
      <Harness
        initial={{ i1: 'b-en', i2: 'b-en' }}
        phase="checked"
        locked={['i1', 'i2', 'i3']}
        verdict={makeVerdict({
          closed: true,
          revealed: true,
          rules: [
            { bucketId: 'b-en', rule: 'Masculine and neuter-looking nouns.' },
            { bucketId: 'b-ei', rule: 'Feminine nouns.' },
          ],
          items: [
            result('i1', {
              chosenBucketId: 'b-en',
              correctBucketId: 'b-ei',
              why: 'bok is a feminine noun.',
            }),
            result('i2', { chosenBucketId: 'b-en', correct: true, correctBucketId: 'b-en' }),
            result('i3', { correctBucketId: 'b-ei', why: 'sol is feminine.' }),
          ],
        })}
      />,
    );

    expect(
      within(zone('ei')).getByRole('button', { name: 'bok, belongs in ei' }),
    ).toBeInTheDocument();
    expect(
      within(zone('ei')).getByRole('button', { name: 'sol, belongs in ei' }),
    ).toBeInTheDocument();
    expect(within(zone('en')).queryByText('bok')).not.toBeInTheDocument();
    expect(within(zone('ei')).getByText('Feminine nouns.')).toBeInTheDocument();
    expect(within(zone('ei')).getByText('bok is a feminine noun.', { exact: false })).toBeVisible();
  });

  it('does not draw a rule or a key before the board is closed', () => {
    render(checked());
    expect(screen.queryByText('Rule:', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /belongs in/ })).not.toBeInTheDocument();
  });

  it('announces the verdict through a polite status (AC-S4)', () => {
    render(checked());
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 right');
  });
});

describe('SortIntoBucketsBody — the counter', () => {
  it('shows nothing about what is left when the author did not ask for it (AC-S9)', () => {
    render(<Harness initial={{ i1: 'b-en' }} />);
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });

  it('shows how many are left in the pool when asked', () => {
    render(<Harness board={makeBoard({ showRemaining: true })} initial={{ i1: 'b-en' }} />);
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('draws no progress bar — placed over total is the remaining count by subtraction (AC-S9)', () => {
    render(<Harness initial={{ i1: 'b-en' }} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('SortIntoBucketsBody — layout and hit areas', () => {
  it('stacks the zones and puts the pool under them on a phone', () => {
    render(<Harness />);
    const zones = zone('en').compareDocumentPosition(
      screen.getByRole('heading', { name: 'Items' }),
    );
    expect(zones & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the pool before the zones when there is room for a column', () => {
    renderWide(<Harness />);
    const pool = screen.getByRole('heading', { name: 'Items' }).compareDocumentPosition(zone('en'));
    expect(pool & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['phone', render],
    ['desktop', renderWide],
  ])('gives every tile and zone a 44px hit area on a %s (AC-S10)', (_name, draw) => {
    draw(<Harness initial={{ i1: 'b-en' }} />);
    for (const element of [tile('bil'), tile(/bok/), zone('en'), zone('ei')]) {
      expect(parseInt(element.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * axe against the rendered body. Colour contrast is skipped because jsdom does no layout
 * or cascade — it would report every element as unknown rather than as passing.
 */
async function violationsIn(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

describe('SortIntoBucketsBody — accessibility (AC-X11)', () => {
  const states: [string, HarnessProps][] = [
    ['answering', { initial: { i1: 'b-en' } }],
    [
      'after a check',
      {
        initial: { i1: 'b-en', i2: 'b-en' },
        phase: 'checked',
        verdict: makeVerdict(),
        locked: ['i2'],
      },
    ],
  ];

  it.each(states)('has no serious violations on a phone while %s', async (_name, props) => {
    const { container } = render(<Harness {...props} />);
    expect(await violationsIn(container)).toEqual([]);
  });

  it.each(states)('has none on a desktop while %s', async (_name, props) => {
    const { container } = renderWide(<Harness {...props} />);
    expect(await violationsIn(container)).toEqual([]);
  });
});
