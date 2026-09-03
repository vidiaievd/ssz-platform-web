import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import type { Translate } from '@/lib/shared-kernel/translate';

// The source card resolves the clip through media-service, and this builder's tests
// mount no QueryClientProvider (plan 56 phase 6).
vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

vi.mock('../../actions/translate', () => ({ saveTranslateAction: vi.fn() }));

const { TranslateBuilder } = await import('./builder');
const { saveTranslateAction } = await import('../../actions/translate');
const { makeDoc, makeItem } = await import('./test-doc');

const LOADED_AT = '2026-08-14T10:00:00.000Z';

function renderBuilder(
  exercise: Translate = makeDoc(),
  // Every builder carries the audio layer, and an exercise that has never had any reads
  // as switched off (plan 56 phase 6).
  audio: AudioDraft = readAudioDraft({}, 'translate_to_target'),
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TranslateBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={exercise}
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
  vi.mocked(saveTranslateAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-14T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TranslateBuilder', () => {
  it('saves an edit without a save button, and keeps the key out of the student column', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction'), '!');
    expect(saveTranslateAction).not.toHaveBeenCalled();

    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(1), DEBOUNCED);
    const [, , input] = vi.mocked(saveTranslateAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.instructions).toBe('Oversett setningene til norsk.!');
    // `content` is the column the student is sent, so no accepted translation may be in it.
    expect(JSON.stringify(input.content)).not.toContain('har bodd');
    expect(input.expectedAnswers.items['i1']?.refs).toEqual(['Jeg har bodd i Tromsø i tre år.']);
    await waitFor(() => expect(screen.getByText(/^Saved at/)).toBeInTheDocument(), DEBOUNCED);
  });

  it('carries the new token into the next save', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction'), 'a');
    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(1), DEBOUNCED);

    await user.type(screen.getByLabelText('Instruction'), 'b');
    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(2), DEBOUNCED);
    const [, , second] = vi.mocked(saveTranslateAction).mock.calls[1]!;
    expect(second.expectedUpdatedAt).toBe('2026-08-14T10:00:05.000Z');
  });

  it('stops on a conflict and offers to write over the version that won', async () => {
    vi.mocked(saveTranslateAction).mockResolvedValueOnce({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-08-14T11:00:00.000Z' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction'), 'a');
    await waitFor(
      () => expect(screen.getByText(/Someone else saved/)).toBeInTheDocument(),
      DEBOUNCED,
    );

    await user.click(screen.getByRole('button', { name: /Save mine anyway/ }));
    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(2), DEBOUNCED);
    const [, , retried] = vi.mocked(saveTranslateAction).mock.calls[1]!;
    expect(retried.expectedUpdatedAt).toBe('2026-08-14T11:00:00.000Z');
  });

  it('marks the step that holds a blocker, and reaches it in one click', async () => {
    const { user } = renderBuilder(makeDoc({ items: [makeItem({ refs: [''] })] }));

    const sentences = screen.getByRole('tab', { name: /The sentences/ });
    expect(within(sentences).getByText('1 problem')).toBeInTheDocument();

    await user.click(sentences);
    expect(sentences).toHaveAttribute('aria-selected', 'true');
  });

  it('blocks the gate while a blocker stands, and links to the step that owns it', async () => {
    const { user } = renderBuilder(makeDoc({ items: [makeItem({ refs: [''] })] }));

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sentence 1 has no accepted translation.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: /no accepted translation/ }));
    expect(screen.getByRole('tab', { name: /The sentences/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /** A guard that its own key trips is a blocker owned by step 3, and reachable there. */
  it('travels from the gate to the step that owns a check problem', async () => {
    const { user } = renderBuilder(
      makeDoc({ items: [makeItem({ forbid: [{ text: 'har bodd' }] })] }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Sentence 1: «har bodd» is forbidden, but your own key contains it.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: /is forbidden/ }));
    expect(screen.getByRole('tab', { name: /The check/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('reaches every step of the rail, each with its own screen', async () => {
    const { user } = renderBuilder();

    for (const [step, heading] of [
      ['The sentences', 'The sentences and their translations'],
      ['The check', 'What the check accepts'],
      ['Flow', 'The road to a mark'],
      ['Direction', 'Which way round?'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: new RegExp(step) }));
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  /*
    The merge of phase 6: one switch, one question about where the sound is, and the same
    rules either way. What the tests pin down is that the two sources are alternatives
    rather than neighbours, and that the layer's blocker knows which one it is judging.
  */
  describe('with audio', () => {
    const listening = (over: Record<string, unknown> = {}): AudioDraft =>
      readAudioDraft({ audio: { enabled: true, source: 'items', ...over } }, 'translate_to_target');

    it('offers a recording per sentence as a source of the layer, not beside it', async () => {
      const { user } = renderBuilder(
        makeDoc({ dir: 'from_target', items: [makeItem({ dir: 'from_target' })] }),
        listening(),
      );
      await user.click(screen.getByRole('tab', { name: /The sentences/ }));

      expect(screen.getByRole('switch', { name: /Listening exercise/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /A recording per sentence/ })).toBeChecked();
      // The exercise-wide clip card belongs to the other source, and only to it.
      expect(screen.queryByText('The clip')).not.toBeInTheDocument();
    });

    it('shows the one clip instead when that is where the sound is', async () => {
      const { user } = renderBuilder(makeDoc(), listening({ source: 'asset', assetId: 'a-1' }));
      await user.click(screen.getByRole('tab', { name: /The sentences/ }));

      expect(screen.getByRole('radio', { name: 'One clip for the set' })).toBeChecked();
      expect(screen.getByText('The clip')).toBeInTheDocument();
    });

    it('blocks a listening set in which no sentence has been recorded', async () => {
      const { user } = renderBuilder(
        makeDoc({ dir: 'from_target', items: [makeItem({ dir: 'from_target' })] }),
        listening(),
      );

      // Step 2 owns the fix, because that is where the sentences are.
      expect(
        within(screen.getByRole('tab', { name: /The sentences/ })).getByText(/problem/),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(
        within(screen.getByRole('dialog')).getByText(/nothing is attached to play/i),
      ).toBeInTheDocument();
    });

    it('is satisfied once one sentence carries a recording', () => {
      renderBuilder(
        makeDoc({
          dir: 'from_target',
          items: [makeItem({ dir: 'from_target', mediaId: 'media-9' })],
        }),
        listening(),
      );

      expect(
        within(screen.getByRole('tab', { name: /The sentences/ })).queryByText(/problem/),
      ).not.toBeInTheDocument();
    });

    it('draws nothing at all while the switch is off', async () => {
      const { user } = renderBuilder();
      await user.click(screen.getByRole('tab', { name: /The sentences/ }));

      expect(screen.getByRole('switch', { name: /Listening exercise/ })).not.toBeChecked();
      expect(
        screen.queryByRole('radio', { name: /A recording per sentence/ }),
      ).not.toBeInTheDocument();
    });
  });
});
