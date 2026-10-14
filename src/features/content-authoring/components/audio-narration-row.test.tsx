import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/media', async () => {
  const actual = await vi.importActual<typeof import('@/features/media')>('@/features/media');
  return {
    ...actual,
    useMediaAsset: vi.fn(),
    useNarrationDefaults: vi.fn(),
    usePreviousAsset: vi.fn(),
    uploadAsset: vi.fn(),
    requestNarration: vi.fn(),
    supersedeAsset: vi.fn(),
  };
});

const { AudioNarrationRow } = await import('./audio-narration-row');
const {
  useMediaAsset,
  useNarrationDefaults,
  usePreviousAsset,
  uploadAsset,
  requestNarration,
  supersedeAsset,
  NarrationRequestError,
} = await import('@/features/media');
const { toNarrationScript } = await import('@/lib/shared-kernel/narration');
const { toast } = await import('sonner');

function renderRow(
  body: string,
  onChange = vi.fn(),
  props: { lang?: string; lessonId?: string; level?: string } = {},
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AudioNarrationRow body={body} onChange={onChange} {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return onChange;
}

/** A READY synthesized narration of `spokenBody`, as media-service reports it. */
function synthesizedAsset(id: string, spokenBody: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    url: `https://cdn.example/${id}.mp3`,
    status: 'READY',
    origin: 'SYNTHESIZED',
    synthesis: {
      provider: 'piper',
      voice: 'no_NO-talesyntese-medium',
      lang: 'nb',
      textHash: toNarrationScript(spokenBody, 'nb').textHash,
      segments: 1,
    },
    ...overrides,
  };
}

const DEFAULTS = {
  fallback: { lengthScale: 1.7, pauseScale: 1 },
  byLevel: {
    A1: { lengthScale: 2, pauseScale: 1 },
    B1: { lengthScale: 1.7, pauseScale: 1 },
    C1: { lengthScale: 1.4, pauseScale: 1 },
  },
  min: { lengthScale: 1, pauseScale: 0.5 },
  max: { lengthScale: 2.5, pauseScale: 2 },
};

beforeEach(() => {
  vi.mocked(useNarrationDefaults).mockReturnValue({ data: DEFAULTS } as never);
  vi.mocked(uploadAsset).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(useMediaAsset).mockReturnValue({ data: undefined, isLoading: false } as never);
  vi.mocked(usePreviousAsset).mockReturnValue({ data: null } as never);
  vi.mocked(requestNarration).mockReset();
  vi.mocked(supersedeAsset).mockReset().mockResolvedValue(undefined);
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

  describe('synthesis (plan 74)', () => {
    it('offers synthesis only when the course language is known', () => {
      renderRow('Some text.');
      expect(screen.queryByRole('button', { name: 'Narrate with synthesis' })).toBeNull();
    });

    it('requests a narration of the body and points the token at the new asset', async () => {
      vi.mocked(requestNarration).mockResolvedValue({ assetId: 'n-1' } as never);
      const onChange = renderRow('Hei, Taras!', vi.fn(), { lang: 'nb', lessonId: 'lesson-1' });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Narrate with synthesis' }));
      });

      expect(requestNarration).toHaveBeenCalledWith({
        bodyMarkdown: 'Hei, Taras!',
        lang: 'nb',
        label: null,
        lessonId: 'lesson-1',
        level: null,
        lengthScale: 1.7,
        pauseScale: 1,
      });
      expect(onChange).toHaveBeenCalledWith('Hei, Taras!\n\n[audio:n-1]');
      // Nothing was replaced, so nothing is marked.
      expect(supersedeAsset).not.toHaveBeenCalled();
    });

    describe('settings', () => {
      const synthesizeClick = async () =>
        act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Narrate with synthesis' }));
        });

      it("starts from the course level's default pace and says so", () => {
        renderRow('Hei.', vi.fn(), { lang: 'nb', level: 'A1' });

        expect(screen.getByLabelText('Speech pace: ×2.00')).toHaveValue('2');
        expect(screen.getByLabelText('Pauses between paragraphs: ×1.0')).toHaveValue('1');
        expect(screen.getByText('Default for level A1: pace ×2.00, pauses ×1.0')).toBeInTheDocument();
      });

      it('sends the level and the chosen pace and pauses with the request', async () => {
        vi.mocked(requestNarration).mockResolvedValue({ assetId: 'n-1' } as never);
        renderRow('Hei.', vi.fn(), { lang: 'nb', level: 'B1' });

        fireEvent.change(screen.getByLabelText(/Speech pace/), { target: { value: '2.2' } });
        fireEvent.change(screen.getByLabelText(/Pauses between paragraphs/), { target: { value: '1.5' } });
        await synthesizeClick();

        expect(requestNarration).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'B1', lengthScale: 2.2, pauseScale: 1.5 }),
        );
      });

      it('resets to the level default, and offers the reset only when something differs', () => {
        renderRow('Hei.', vi.fn(), { lang: 'nb', level: 'B1' });
        const reset = screen.getByRole('button', { name: 'Reset to default' });
        expect(reset).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/Speech pace/), { target: { value: '2.2' } });
        expect(reset).toBeEnabled();

        fireEvent.click(reset);
        expect(screen.getByLabelText('Speech pace: ×1.70')).toHaveValue('1.7');
        expect(reset).toBeDisabled();
      });

      it('falls back to the service default for a level it has no table for', () => {
        renderRow('Hei.', vi.fn(), { lang: 'nb', level: 'N4' });

        expect(screen.getByLabelText('Speech pace: ×1.70')).toBeInTheDocument();
        expect(screen.getByText('Default: pace ×1.70, pauses ×1.0')).toBeInTheDocument();
      });

      it('repeats what the current synthesis was spoken with when narrating again', async () => {
        const body = 'Hei, Taras!\n\n[audio:n-1 "Les"]';
        const asset = synthesizedAsset('n-1', body);
        vi.mocked(useMediaAsset).mockReturnValue({
          data: { ...asset, synthesis: { ...asset.synthesis, lengthScale: 2.3, pauseScale: 0.7 } },
        } as never);
        vi.mocked(requestNarration).mockResolvedValue({ assetId: 'n-2' } as never);
        renderRow(body, vi.fn(), { lang: 'nb', level: 'B1' });

        expect(screen.getByLabelText('Speech pace: ×2.30')).toBeInTheDocument();
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Narrate again' }));
        });

        expect(requestNarration).toHaveBeenCalledWith(
          expect.objectContaining({ lengthScale: 2.3, pauseScale: 0.7 }),
        );
      });

      it('has no settings for a recording a person made', () => {
        vi.mocked(useMediaAsset).mockReturnValue({
          data: { id: 'rec-1', url: 'https://cdn.example/rec.mp3', status: 'READY', origin: 'UPLOAD' },
        } as never);
        renderRow('Hei.\n\n[audio:rec-1]', vi.fn(), { lang: 'nb' });

        expect(screen.queryByText('Narration settings')).toBeNull();
      });
    });

    it('names the reason a narration was refused', async () => {
      vi.mocked(requestNarration).mockRejectedValue(
        new NarrationRequestError(422, 'TEXT_TOO_LONG'),
      );
      renderRow('Hei.', vi.fn(), { lang: 'nb' });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Narrate with synthesis' }));
      });

      expect(toast.error).toHaveBeenCalledWith('The text is too long to narrate in one go.');
    });

    it('marks a synthesized narration and offers to redo it or replace it with a recording', () => {
      const body = 'Hei, Taras!\n\n[audio:n-1 "Les"]';
      vi.mocked(useMediaAsset).mockReturnValue({ data: synthesizedAsset('n-1', body) } as never);
      renderRow(body, vi.fn(), { lang: 'nb' });

      expect(screen.getByText('Synthesized · no_NO-talesyntese-medium')).toBeInTheDocument();
      expect(screen.queryByText(/Outdated/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Narrate again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Replace with a recording' })).toBeInTheDocument();
    });

    it('calls a narration outdated after a word changes, not after the token changes', () => {
      const spoken = 'Hei, Taras!\n\n[audio:n-1]';
      vi.mocked(useMediaAsset).mockReturnValue({ data: synthesizedAsset('n-1', spoken) } as never);

      renderRow('Hei, Taras!\n\n[audio:n-1 "A new label"]', vi.fn(), { lang: 'nb' });
      expect(screen.queryByText(/Outdated/)).toBeNull();
    });

    it('shows the outdated warning once the text differs from what was spoken', () => {
      vi.mocked(useMediaAsset).mockReturnValue({
        data: synthesizedAsset('n-1', 'Hei, Taras!'),
      } as never);

      renderRow('Hei, Silje!\n\n[audio:n-1]', vi.fn(), { lang: 'nb' });
      expect(
        screen.getByText('Outdated: the text changed after it was synthesized'),
      ).toBeInTheDocument();
    });

    it('labels an uploaded narration as a recording', () => {
      vi.mocked(useMediaAsset).mockReturnValue({
        data: { id: 'r-1', url: 'https://cdn.example/r.mp3', status: 'READY', origin: 'UPLOAD' },
      } as never);
      renderRow('Text.\n\n[audio:r-1]', vi.fn(), { lang: 'nb' });

      expect(screen.getByText('Recording')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Narrate again' })).toBeNull();
    });

    it('says the narration is being spoken while the asset is pending', () => {
      vi.mocked(useMediaAsset).mockReturnValue({
        data: { ...synthesizedAsset('n-1', 'Hei.'), status: 'PENDING_UPLOAD', url: 'x' },
      } as never);
      renderRow('Hei.\n\n[audio:n-1]', vi.fn(), { lang: 'nb' });

      expect(screen.getByRole('status')).toHaveTextContent('Synthesizing the narration…');
      expect(document.querySelector('audio')).toBeNull();
    });

    it('marks the old narration replaced when it is synthesized again (D5)', async () => {
      const body = 'Hei.\n\n[audio:n-1 "Les"]';
      vi.mocked(useMediaAsset).mockReturnValue({
        data: synthesizedAsset('n-1', 'Old text.'),
      } as never);
      vi.mocked(requestNarration).mockResolvedValue({ assetId: 'n-2' } as never);
      const onChange = renderRow(body, vi.fn(), { lang: 'nb' });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Narrate again' }));
      });

      expect(requestNarration).toHaveBeenCalledWith(expect.objectContaining({ label: 'Les' }));
      expect(onChange).toHaveBeenCalledWith('Hei.\n\n[audio:n-2 "Les"]');
      expect(supersedeAsset).toHaveBeenCalledWith('n-1', 'n-2');
    });

    it('restores the previous narration while it is restorable', async () => {
      const body = 'Hei.\n\n[audio:n-2]';
      vi.mocked(useMediaAsset).mockReturnValue({ data: synthesizedAsset('n-2', body) } as never);
      vi.mocked(usePreviousAsset).mockReturnValue({
        data: {
          id: 'r-1',
          status: 'READY',
          restorableUntil: new Date(Date.now() + 86_400_000).toISOString(),
        },
      } as never);
      const onChange = renderRow(body, vi.fn(), { lang: 'nb' });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Restore the previous one' }));
      });

      expect(onChange).toHaveBeenCalledWith('Hei.\n\n[audio:r-1]');
      expect(supersedeAsset).toHaveBeenCalledWith('n-2', 'r-1');
    });

    it('does not offer a previous narration past its retention', () => {
      vi.mocked(useMediaAsset).mockReturnValue({ data: synthesizedAsset('n-2', 'Hei.') } as never);
      vi.mocked(usePreviousAsset).mockReturnValue({
        data: {
          id: 'r-1',
          status: 'READY',
          restorableUntil: new Date(Date.now() - 1000).toISOString(),
        },
      } as never);
      renderRow('Hei.\n\n[audio:n-2]', vi.fn(), { lang: 'nb' });

      expect(screen.queryByRole('button', { name: 'Restore the previous one' })).toBeNull();
    });
  });
});
