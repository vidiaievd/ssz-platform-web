import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import type { Translate } from '@/lib/shared-kernel/translate';

import { StepSentences } from './step-sentences';
import { makeDoc, makeItem } from './test-doc';

// The clip card resolves the asset through media-service, and these tests mount no
// QueryClientProvider (plan 56 phase 6).
vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(
  exercise: Translate = makeDoc(),
  onChange = vi.fn(),
  audio: AudioDraft = readAudioDraft({}, 'translate_to_target'),
) {
  const onAudioChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepSentences
        exercise={exercise}
        onChange={onChange}
        audio={audio}
        onAudioChange={onAudioChange}
      />
    </NextIntlClientProvider>,
  );
  return { onChange, onAudioChange, user: userEvent.setup() };
}

describe('StepSentences', () => {
  it('counts what predicts the marking load: variants, and how many sentences have several', () => {
    renderStep(
      makeDoc({
        items: [
          makeItem({ refs: ['Jeg (har bodd|bodde) i Tromsø i tre år.'] }),
          makeItem({ id: 'i2', source: 'Я люблю кошек.', refs: ['Jeg liker katter.'] }),
        ],
      }),
    );

    const variants = screen.getByText('Accepted variants').closest('div')!;
    expect(within(variants).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 sentences accept more than one wording')).toBeInTheDocument();
  });

  /** What the author wrote, expanded — the only way to see what an inline alternative did. */
  it('shows what a key line with alternatives expands into', () => {
    renderStep(makeDoc({ items: [makeItem({ refs: ['Jeg (liker|elsker) katter.'] })] }));

    expect(screen.getByText('2 variants:')).toBeInTheDocument();
    expect(screen.getByText('Jeg liker katter.')).toBeInTheDocument();
    expect(screen.getByText('Jeg elsker katter.')).toBeInTheDocument();
  });

  /**
   * `(nå|)` makes a word optional, and the shorter reading is a variant of its own — the
   * chips are where an author sees that the optional half actually took.
   */
  it('counts the shorter reading of an optional word as a variant', () => {
    renderStep(makeDoc({ items: [makeItem({ refs: ['Jeg bor her (nå|).'] })] }));

    expect(screen.getByText('2 variants:')).toBeInTheDocument();
    expect(screen.getByText('Jeg bor her nå.')).toBeInTheDocument();
    expect(screen.getByText('Jeg bor her .')).toBeInTheDocument();
  });

  /**
   * A sentence with no key is not merely unpolished: the check has nothing to measure
   * against, so the card says so rather than leaving it to the finish gate.
   */
  it('calls out a sentence with no accepted translation on the card', () => {
    renderStep(makeDoc({ items: [makeItem({ refs: [''] })] }));

    expect(screen.getByText('no answer key')).toBeInTheDocument();
    expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
  });

  it('adds a sentence that inherits the direction of the set', async () => {
    const { user, onChange } = renderStep(makeDoc({ dir: 'from_target' }));

    await user.click(screen.getByRole('button', { name: 'Add a sentence' }));

    const next = onChange.mock.calls[0]![0] as Translate;
    expect(next.items).toHaveLength(2);
    expect(next.items[1]!.dir).toBe('from_target');
    expect(next.items[1]!.refs).toEqual(['']);
  });

  it('lets one sentence of a mixed set be turned round on its own card', async () => {
    const { user, onChange } = renderStep(makeDoc({ dir: 'both' }));

    await user.click(screen.getByRole('button', { name: 'Russisk → Norsk' }));

    const next = onChange.mock.calls[0]![0] as Translate;
    expect(next.items[0]!.dir).toBe('from_target');
    expect(next.dir).toBe('both');
  });

  it('keeps the sentence-level explanation with the rest of the extras', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('button', { name: 'More' }));
    // One keystroke: the document is controlled from outside, and this render never
    // receives the edit back, so a second character would only replace the first.
    await user.type(screen.getByLabelText('Why the key reads this way'), 'V');

    const next = onChange.mock.calls.at(-1)![0] as Translate;
    expect(next.items[0]!.explanation).toBe('V');
  });

  it('adds a word note from the two fields under the sentence', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.type(screen.getByLabelText('Word'), 'уже');
    await user.type(screen.getByLabelText('Note'), 'allerede{Enter}');

    const next = onChange.mock.calls.at(-1)![0] as Translate;
    expect(next.items[0]!.gloss).toEqual([{ w: 'уже', t: 'allerede' }]);
  });

  it('shows only the first sentence when the format is a single one', () => {
    renderStep(
      makeDoc({
        format: 'single',
        items: [makeItem(), makeItem({ id: 'i2', source: 'Я люблю кошек.' })],
      }),
    );

    expect(screen.getAllByLabelText('Sentence in Russisk')).toHaveLength(1);
    expect(screen.queryByText('Sentence 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a sentence' })).not.toBeInTheDocument();
  });
});
