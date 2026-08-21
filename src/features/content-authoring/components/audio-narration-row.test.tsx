import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/media', async () => {
  const actual = await vi.importActual<typeof import('@/features/media')>('@/features/media');
  return { ...actual, useMediaAsset: vi.fn(), uploadAsset: vi.fn() };
});

const { AudioNarrationRow } = await import('./audio-narration-row');
const { useMediaAsset, uploadAsset } = await import('@/features/media');
const { toast } = await import('sonner');

function renderRow(body: string, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AudioNarrationRow body={body} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

beforeEach(() => {
  vi.mocked(uploadAsset).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(useMediaAsset).mockReturnValue({ data: undefined, isLoading: false } as never);
});

describe('AudioNarrationRow', () => {
  it('shows an upload prompt when the body has no narration token', () => {
    renderRow('Just some text.');
    expect(screen.getByRole('button', { name: 'Upload audio' })).toBeInTheDocument();
  });

  it('shows the audio player, label, and replace/remove actions when a token exists', () => {
    vi.mocked(useMediaAsset).mockReturnValue({
      data: { id: 'media-2', url: 'https://cdn.example/narration.mp3' },
      isLoading: false,
    } as never);
    renderRow('Text.\n\n[audio:media-2 "Narrator"]');

    const audio = document.querySelector('audio');
    expect(audio).toHaveAttribute('src', 'https://cdn.example/narration.mp3');
    expect(screen.getByDisplayValue('Narrator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('removes the token and reports the new body', () => {
    vi.mocked(useMediaAsset).mockReturnValue({
      data: { id: 'media-2', url: 'https://cdn.example/narration.mp3' },
      isLoading: false,
    } as never);
    const onChange = renderRow('Text.\n\n[audio:media-2 "Narrator"]');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onChange).toHaveBeenCalledWith('Text.');
  });

  it('edits the label in place', () => {
    vi.mocked(useMediaAsset).mockReturnValue({
      data: { id: 'media-2', url: 'https://cdn.example/narration.mp3' },
      isLoading: false,
    } as never);
    const onChange = renderRow('Text.\n\n[audio:media-2 "Old label"]');

    fireEvent.change(screen.getByDisplayValue('Old label'), { target: { value: 'New label' } });

    expect(onChange).toHaveBeenCalledWith('Text.\n\n[audio:media-2 "New label"]');
  });

  it('uploads a file and appends a new token', async () => {
    vi.mocked(uploadAsset).mockResolvedValue({
      asset: {
        id: 'media-3',
        url: 'https://cdn.example/new.mp3',
        mimeType: 'audio/mpeg',
        size: 5,
        filename: 'a.mp3',
        createdAt: '',
      },
    });
    const onChange = renderRow('Some text.');

    const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('Some text.\n\n[audio:media-3]'));
  });

  it('rejects an unsupported file type before uploading', async () => {
    const onChange = renderRow('Some text.');

    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Please upload an MP3, OGG, WAV, AAC, FLAC, or M4A audio file.',
    );
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
