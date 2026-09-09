import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import { DEFAULT_SETTINGS, type MatchPairs } from '@/lib/shared-kernel/match-pairs';

// The source card resolves the clip through media-service, and this builder's tests
// mount no QueryClientProvider (plan 56 phase 6).
vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

vi.mock('../../actions/match-pairs', () => ({ saveMatchPairsAction: vi.fn() }));

const { MatchPairsBuilder } = await import('./builder');
const { saveMatchPairsAction } = await import('../../actions/match-pairs');

const LOADED_AT = '2026-08-21T10:00:00.000Z';

function doc(overrides: Partial<MatchPairs> = {}): MatchPairs {
  return {
    id: 'ex-1',
    type: 'match_pairs',
    moduleId: 'module-1',
    title: '',
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
    updatedAt: LOADED_AT,
    ...overrides,
  };
}

function renderBuilder(
  exercise: MatchPairs = doc(),
  variantChosen = true,
  // Every builder carries the audio layer, and an exercise that has never had any reads
  // as switched off (plan 56 phase 6).
  audio: AudioDraft = readAudioDraft({}, 'match_pairs'),
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MatchPairsBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={exercise}
        initialInstructions={exercise.instructions}
        initialAudio={audio}
        initialVariantChosen={variantChosen}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

// Real timers: the debounce is 800ms and the assertions wait it out. Fake timers here
// fight `waitFor`, which runs timers of its own.
const DEBOUNCED = { timeout: 3_000 };

beforeEach(() => {
  vi.mocked(saveMatchPairsAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-21T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MatchPairsBuilder', () => {
  it('saves an edit without a save button, and says so (AC-B23)', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction the student sees'), '!');
    expect(saveMatchPairsAction).not.toHaveBeenCalled();

    await waitFor(() => expect(saveMatchPairsAction).toHaveBeenCalledTimes(1), DEBOUNCED);
    await waitFor(() => expect(screen.getByText(/Saved at/)).toBeInTheDocument(), DEBOUNCED);

    const [, , input] = vi.mocked(saveMatchPairsAction).mock.calls[0]!;
    expect(input.instructions).toBe('Sett sammen halvdelene.!');
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.pairs).toHaveLength(3);
  });

  it('keeps the edit on screen and offers a retry when the save fails (AC-B24)', async () => {
    vi.mocked(saveMatchPairsAction).mockResolvedValue({
      ok: false,
      error: { code: 'internal', message: 'boom' },
    } as never);
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction the student sees'), '!');

    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument(), DEBOUNCED);
    expect(screen.getByLabelText('Instruction the student sees')).toHaveValue(
      'Sett sammen halvdelene.!',
    );
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });

  it('hands a conflict to the teacher rather than retrying it', async () => {
    vi.mocked(saveMatchPairsAction).mockResolvedValue({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-08-21T11:00:00.000Z' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction the student sees'), '!');

    await waitFor(
      () => expect(screen.getByText('Someone else saved this exercise')).toBeInTheDocument(),
      DEBOUNCED,
    );
    expect(screen.getByRole('button', { name: /Keep my version/ })).toBeInTheDocument();
  });

  it('lists blockers before warnings and walks to the step that fixes one (AC-B25)', async () => {
    const { user } = renderBuilder(
      doc({
        pairs: [
          { id: 'p1', rightId: 'h1', left: 'Hun sa at', right: '' },
          { id: 'p2', rightId: 'h2', left: 'Jeg tror', right: 'det går bra.' },
        ],
        distractors: [],
      }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Review & finish' })[0]!);

    const dialog = screen.getByRole('dialog');
    const rows = within(dialog).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Pair 1 has only one half written');
    expect(rows[1]).toHaveTextContent('Only 1 complete pairs — at least 3 are needed');

    await user.click(rows[1]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^1Pairs/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('disables the gate action and names the blocker count (AC-B26)', async () => {
    const { user } = renderBuilder(doc({ feedback: {} }));

    await user.click(screen.getAllByRole('button', { name: 'Review & finish' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Fix 3 blockers first' })).toBeDisabled();
  });

  it('clears the gate when the document has nothing against it', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getAllByRole('button', { name: 'Review & finish' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Nothing is standing in the way.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('counts an unchosen variant as a step-1 blocker in the rail and the gate', async () => {
    const { user } = renderBuilder(doc(), false);

    expect(screen.getByRole('tab', { name: /^1Pairs/ })).toHaveTextContent('1 problem');

    await user.click(screen.getAllByRole('button', { name: 'Review & finish' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Choose what kind of pairs this is — the two are graded by different rules.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Fix 1 blocker first' })).toBeDisabled();
  });

  it('shows problems per step on the rail, in count and in words (AC-B27)', () => {
    renderBuilder(doc({ distractors: [], feedback: {} }));

    expect(screen.getByRole('tab', { name: /^2Right column/ })).toHaveTextContent('1 warning');
    expect(screen.getByRole('tab', { name: /^3Feedback/ })).toHaveTextContent('3 problems');
  });

  it('reaches any step in any order, and the steps are the authoring ones', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /^3Feedback/ }));
    expect(screen.getByText('What the student is told')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^2Right column/ }));
    expect(screen.getByText('Correct halves')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit in step 1' }));
    expect(screen.getByText('Pairs of halves')).toBeInTheDocument();
  });

  /* The listening layer on this builder (plan 56 phase 6). */
  describe('with audio', () => {
    const listening = (over: Record<string, unknown> = {}): AudioDraft =>
      readAudioDraft(
        { audio: { enabled: true, source: 'asset', assetId: 'a-1', title: 'Dialog', ...over } },
        'match_pairs',
      );

    it('puts the switch and the clip with the pairs', () => {
      renderBuilder(doc(), true, listening());

      expect(screen.getByRole('switch', { name: /Listening exercise/ })).toBeChecked();
      expect(screen.getByText('The clip')).toBeInTheDocument();
    });

    it('reports a missing clip as a blocker on the step that owns the fix', () => {
      renderBuilder(doc(), true, listening({ assetId: '' }));

      expect(
        within(screen.getByRole('tab', { name: /Pairs/ })).getByText(/problem/),
      ).toBeInTheDocument();
    });

    it('draws nothing at all while the switch is off', () => {
      renderBuilder();

      expect(screen.getByRole('switch', { name: /Listening exercise/ })).not.toBeChecked();
      expect(screen.queryByText('The clip')).not.toBeInTheDocument();
    });
  });
});
