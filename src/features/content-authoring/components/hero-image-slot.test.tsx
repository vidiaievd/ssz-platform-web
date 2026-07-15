import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('@/features/media', async () => {
  const actual = await vi.importActual<typeof import('@/features/media')>('@/features/media');
  return { ...actual, useMediaAsset: vi.fn(), uploadAsset: vi.fn() };
});

const { HeroImageSlot } = await import('./hero-image-slot');
const { useMediaAsset, uploadAsset } = await import('@/features/media');

function renderSlot(body: string, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HeroImageSlot body={body} altDefault="En vanlig arbeidsdag" onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

beforeEach(() => {
  vi.mocked(uploadAsset).mockReset();
  vi.mocked(useMediaAsset).mockReturnValue({ data: undefined, isLoading: false } as never);
});

describe('HeroImageSlot', () => {
  it('shows an upload prompt when the body has no image token', () => {
    renderSlot('Just some text.');
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
  });

  it('shows the current image, its alt text, and replace/remove actions when a token exists', () => {
    vi.mocked(useMediaAsset).mockReturnValue({
      data: { id: 'media-1', url: 'https://cdn.example/hero.jpg' },
      isLoading: false,
    } as never);
    renderSlot('![A busy workday](media://media-1)\n\nSome text.');

    expect(screen.getByAltText('A busy workday')).toHaveAttribute('src', 'https://cdn.example/hero.jpg');
    expect(screen.getByDisplayValue('A busy workday')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('removes the token and reports the new body', () => {
    vi.mocked(useMediaAsset).mockReturnValue({
      data: { id: 'media-1', url: 'https://cdn.example/hero.jpg' },
      isLoading: false,
    } as never);
    const onChange = renderSlot('![A busy workday](media://media-1)\n\nSome text.');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onChange).toHaveBeenCalledWith('Some text.');
  });

  it('edits the alt text in place', () => {
    vi.mocked(useMediaAsset).mockReturnValue({
      data: { id: 'media-1', url: 'https://cdn.example/hero.jpg' },
      isLoading: false,
    } as never);
    const onChange = renderSlot('![Old alt](media://media-1)\n\nSome text.');

    fireEvent.change(screen.getByDisplayValue('Old alt'), { target: { value: 'New alt' } });

    expect(onChange).toHaveBeenCalledWith('![New alt](media://media-1)\n\nSome text.');
  });

  it('uploads a file and inserts a new token using the default alt text', async () => {
    vi.mocked(uploadAsset).mockResolvedValue({
      asset: { id: 'media-2', url: 'https://cdn.example/new.jpg', mimeType: 'image/jpeg', size: 5, filename: 'a.jpg', createdAt: '' },
    });
    const onChange = renderSlot('Some text.');

    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        '![En vanlig arbeidsdag](media://media-2)\n\nSome text.',
      ),
    );
  });
});
