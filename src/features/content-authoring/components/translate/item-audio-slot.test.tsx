import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

const useMediaAsset = vi.fn((_id?: string): { data: { id: string; url: string } | undefined } => ({
  data: undefined,
}));
const uploadAsset = vi.fn();

vi.mock('@/features/media', () => ({
  useMediaAsset: (id?: string) => useMediaAsset(id),
  uploadAsset: (args: unknown) => uploadAsset(args),
}));

const { ItemAudioSlot } = await import('./item-audio-slot');

function renderSlot(props: Partial<React.ComponentProps<typeof ItemAudioSlot>> = {}) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ItemAudioSlot onChange={onChange} {...props} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

/** The file input is deliberately out of the accessibility tree; the test drives it directly. */
function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]')!;
}

beforeEach(() => {
  useMediaAsset.mockReturnValue({ data: undefined });
  uploadAsset.mockResolvedValue({ asset: { id: 'media-9', url: 'https://cdn.test/a.mp3' } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ItemAudioSlot', () => {
  it('offers to attach a recording to the sentence', () => {
    renderSlot();

    expect(screen.getByRole('button', { name: /Attach audio/ })).toBeEnabled();
  });

  it('reports the uploaded asset id, which is what the document stores', async () => {
    const { onChange, user } = renderSlot();

    await user.upload(fileInput(), new File(['x'], 'setning.mp3', { type: 'audio/mpeg' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('media-9'));
  });

  it('refuses a file that is not audio without troubling media-service', async () => {
    const { onChange, user } = renderSlot();

    await user.upload(fileInput(), new File(['x'], 'setning.pdf', { type: 'application/pdf' }));

    expect(uploadAsset).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * With `to_target` the sentence on screen is in the language of explanation: voicing it
   * would read out the meaning the student is supposed to produce.
   */
  it('says why the wrong direction has nothing to voice, instead of showing a dead button', () => {
    renderSlot({ disabledReason: 'The sentence is read in Russisk.' });

    expect(screen.getByText('The sentence is read in Russisk.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Attach audio/ })).not.toBeInTheDocument();
  });

  /** An attachment made before the direction changed must stay removable. */
  it('keeps an existing recording playable and removable after the direction turns', async () => {
    useMediaAsset.mockReturnValue({ data: { id: 'media-9', url: 'https://cdn.test/a.mp3' } });
    const { onChange, user } = renderSlot({
      mediaId: 'media-9',
      disabledReason: 'The sentence is read in Russisk.',
    });

    expect(screen.getByRole('button', { name: /Replace audio/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
