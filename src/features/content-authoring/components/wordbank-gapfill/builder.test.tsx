import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

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

function renderBuilder(exercise: WordBankGapFill = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GapFillBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={exercise}
        initialInstructions="Fyll inn ordene."
        initialHint=""
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
