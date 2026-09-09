import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import {
  DEFAULT_SETTINGS,
  TEMPLATE_CODE,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

// The source card resolves the clip through media-service, and this builder's tests
// mount no QueryClientProvider (plan 56 phase 5).
vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

vi.mock('../../actions/gap-fill', () => ({ saveGapFillAction: vi.fn() }));

const { GapFillBuilder } = await import('./builder');
const { saveGapFillAction } = await import('../../actions/gap-fill');

const LOADED_AT = '2026-08-05T10:00:00.000Z';

function doc(overrides: Partial<WordBankGapFill> = {}): WordBankGapFill {
  return {
    id: 'ex-1',
    type: 'word_bank_gap_fill',
    moduleId: 'module-1',
    title: '',
    instructions: 'Fyll inn ordene.',
    settings: { ...DEFAULT_SETTINGS },
    sentences: [{ id: 's1', text: 'Jeg vil gjerne bestille en kaffe.', gaps: [3] }],
    distractors: ['bestilt', 'bestilling'],
    feedback: {
      's1#3': { fallback: 'Her mangler verbet.', why: 'Infinitiv.', pairs: {} },
    },
    updatedAt: LOADED_AT,
    ...overrides,
  };
}

function renderBuilder(
  exercise: WordBankGapFill = doc(),
  // Every builder carries the audio layer, and an exercise that has never had any reads
  // as switched off (plan 56 phase 5).
  audio: AudioDraft = readAudioDraft({}, TEMPLATE_CODE),
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GapFillBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={exercise}
        initialInstructions="Fyll inn ordene."
        initialHint=""
        initialAudio={audio}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

// Real timers: the debounce is 800ms and the assertions wait it out. Fake timers here
// fight `waitFor`, which runs timers of its own.
const DEBOUNCED = { timeout: 3_000 };

beforeEach(() => {
  vi.mocked(saveGapFillAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-05T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GapFillBuilder', () => {
  it('saves an edit without a save button, and reports it (AC-B22)', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instructions'), '!');
    expect(saveGapFillAction).not.toHaveBeenCalled();

    await waitFor(() => expect(saveGapFillAction).toHaveBeenCalledTimes(1), DEBOUNCED);
    const [, , input] = vi.mocked(saveGapFillAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.instructions).toBe('Fyll inn ordene.!');
    await waitFor(() => expect(screen.getByText(/^Saved at/)).toBeInTheDocument(), DEBOUNCED);
  });

  it('coalesces a burst of edits into one save', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instructions'), 'abc');

    await waitFor(() => expect(saveGapFillAction).toHaveBeenCalledTimes(1), DEBOUNCED);
  });

  it('carries the new token into the next save', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instructions'), 'a');
    await waitFor(() => expect(saveGapFillAction).toHaveBeenCalledTimes(1), DEBOUNCED);
    await user.type(screen.getByLabelText('Instructions'), 'b');
    await waitFor(() => expect(saveGapFillAction).toHaveBeenCalledTimes(2), DEBOUNCED);

    const [, , second] = vi.mocked(saveGapFillAction).mock.calls[1]!;
    expect(second.expectedUpdatedAt).toBe('2026-08-05T10:00:05.000Z');
  });

  it('keeps the edit on screen when the save fails, and offers a retry (AC-B23)', async () => {
    vi.mocked(saveGapFillAction).mockResolvedValueOnce({
      ok: false,
      error: { code: 'upstream_unavailable', message: 'nope' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instructions'), '!');

    await waitFor(
      () =>
        expect(screen.getByText('Save failed — your edits are still here.')).toBeInTheDocument(),
      DEBOUNCED,
    );
    expect(screen.getByLabelText('Instructions')).toHaveValue('Fyll inn ordene.!');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText(/^Saved at/)).toBeInTheDocument(), DEBOUNCED);
  });

  it('stops saving on a conflict rather than overwriting the other author', async () => {
    vi.mocked(saveGapFillAction).mockResolvedValue({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-08-05T11:00:00.000Z' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instructions'), '!');

    await waitFor(
      () =>
        expect(
          screen.getByText('Someone else saved this exercise. Your edits are still here.'),
        ).toBeInTheDocument(),
      DEBOUNCED,
    );

    // A further edit does not queue another write behind the conflict.
    await user.type(screen.getByLabelText('Instructions'), '?');
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(saveGapFillAction).toHaveBeenCalledTimes(1);
  });

  it('writes nothing until the document is edited, and stops once it is saved', async () => {
    // The two ways an autosave writes work nobody did: on mount, and again after every
    // save because the token it just received counted as a change. Both cost a teacher
    // their editor when the write lands on a version the page no longer holds.
    const { user } = renderBuilder();

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(saveGapFillAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Instructions'), '!');
    await waitFor(() => expect(saveGapFillAction).toHaveBeenCalledTimes(1), DEBOUNCED);

    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(saveGapFillAction).toHaveBeenCalledTimes(1);
  });

  it('offers a way out of a conflict, writing over the version that won', async () => {
    vi.mocked(saveGapFillAction).mockResolvedValueOnce({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-08-05T11:00:00.000Z' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instructions'), '!');
    await waitFor(
      () => expect(screen.getByRole('button', { name: /Save mine anyway/ })).toBeInTheDocument(),
      DEBOUNCED,
    );

    await user.click(screen.getByRole('button', { name: /Save mine anyway/ }));

    await waitFor(() => expect(screen.getByText(/^Saved at/)).toBeInTheDocument(), DEBOUNCED);
    const [, , second] = vi.mocked(saveGapFillAction).mock.calls[1]!;
    // The token the server reported, not the one that was refused.
    expect(second.expectedUpdatedAt).toBe('2026-08-05T11:00:00.000Z');
    expect(second.instructions).toBe('Fyll inn ordene.!');
  });

  it('counts the problems per step on the rail (AC-B26)', async () => {
    const { user } = renderBuilder(doc({ feedback: {}, distractors: ['bestilt'] }));

    const feedbackTab = screen.getByRole('tab', { name: /Feedback/ });
    expect(feedbackTab).toHaveTextContent('1 problem');
    // Two words for one gap is thin, not broken: a warning, not a blocker.
    expect(screen.getByRole('tab', { name: /Word bank/ })).toHaveTextContent('to check');
    expect(screen.getByRole('tab', { name: /Sentences/ })).toHaveTextContent('ready');

    await user.click(feedbackTab);
    expect(screen.getByLabelText('Default explanation')).toBeInTheDocument();
  });

  it('lists blockers before warnings in the gate and navigates to the step (AC-B24, AC-B25)', async () => {
    const { user } = renderBuilder(doc({ feedback: {} }));

    await user.click(screen.getByRole('button', { name: 'Done' }));

    const rows = screen.getAllByRole('button', { name: /Go to step/ });
    expect(rows[0]).toHaveTextContent('G1 has no default explanation.');
    expect(screen.getByRole('button', { name: 'Fix 1 problem first' })).toBeDisabled();

    await user.click(rows[0]!);
    expect(screen.getByLabelText('Default explanation')).toBeInTheDocument();
  });

  it('walks forward and back through the steps from the footer', async () => {
    const { user } = renderBuilder();

    expect(screen.getByRole('button', { name: /^Back/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Next: Word bank/ }));
    expect(screen.getByRole('tab', { name: /Word bank/ })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: /Next: Feedback/ }));
    expect(screen.getByLabelText('Default explanation')).toBeInTheDocument();
    // The last step ends in the gate, not in another step.
    expect(screen.queryByRole('button', { name: /^Next:/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Back/ }));
    expect(screen.getByRole('tab', { name: /Word bank/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('says so when nothing is in the way', async () => {
    // Typed input: no bank to be thin, and no pair matrix to be half-written, so this
    // is the shortest document with genuinely nothing outstanding.
    const { user } = renderBuilder(
      doc({ settings: { ...DEFAULT_SETTINGS, input: 'free' }, distractors: [] }),
    );

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText(/ready to assign/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });
});

/* The listening layer on this builder (plan 56 phase 5). */
describe('GapFillBuilder — with audio', () => {
  const listening = (over: Record<string, unknown> = {}): AudioDraft =>
    readAudioDraft(
      {
        audio: {
          enabled: true,
          source: 'asset',
          assetId: 'asset-1',
          title: 'Diktat',
          duration: 96,
          settings: { transcriptWhen: 'never' },
          ...over,
        },
      },
      TEMPLATE_CODE,
    );

  it('puts the switch and the clip where the instruction already is', () => {
    renderBuilder(doc(), listening());

    expect(screen.getByRole('switch', { name: /Listening exercise/ })).toBeChecked();
    expect(screen.getByText('The clip')).toBeInTheDocument();
  });

  it('reports a missing clip as a blocker on the step that owns the fix', () => {
    // Three steps, not four: the clip is step 1's, with the sentences it is read from.
    renderBuilder(doc(), listening({ assetId: '' }));

    expect(
      within(screen.getByRole('tab', { name: /Sentences/ })).getByText('1 problem'),
    ).toBeInTheDocument();
  });

  it('draws nothing at all while the switch is off', () => {
    renderBuilder();

    expect(screen.getByRole('switch', { name: /Listening exercise/ })).not.toBeChecked();
    expect(screen.queryByText('The clip')).not.toBeInTheDocument();
  });
});
