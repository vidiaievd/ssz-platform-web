import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonVideoCue } from '@/features/content/types';

vi.mock('@/features/media', () => ({ useMediaAsset: vi.fn() }));

const { VideoLessonPreview } = await import('./video-lesson-preview');
const { useMediaAsset } = await import('@/features/media');

function renderPreview(props: { title: string; body: string; cues: LessonVideoCue[] }) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VideoLessonPreview {...props} />
    </NextIntlClientProvider>,
  );
}

const CUES: LessonVideoCue[] = [
  { position: 0, startSeconds: 0, targetLine: 'Hei!', translationLine: 'Hi!' },
  { position: 1, startSeconds: 5, targetLine: 'Ha det!', translationLine: null },
];

beforeEach(() => {
  vi.mocked(useMediaAsset).mockReturnValue({
    data: { id: 'media-1', url: 'https://cdn.test/video.mp4' },
  } as never);
});

describe('VideoLessonPreview', () => {
  it('shows the empty state when there is no video source', () => {
    vi.mocked(useMediaAsset).mockReturnValue({ data: undefined } as never);
    renderPreview({ title: 'Greetings', body: '', cues: [] });
    expect(screen.getByText('Nothing to preview.')).toBeInTheDocument();
  });

  it('renders the video and the full cue list', () => {
    renderPreview({ title: 'Greetings', body: '[video:media-1]', cues: CUES });
    expect(screen.getByText('Greetings')).toBeInTheDocument();
    expect(document.querySelector('video')?.getAttribute('src')).toBe('https://cdn.test/video.mp4');
    expect(screen.getAllByText('Hei!')).toHaveLength(2); // subtitle overlay (active cue) + transcript list
    expect(screen.getByText('Ha det!')).toBeInTheDocument();
  });

  it('highlights the active cue and shows its translation as playback advances', () => {
    renderPreview({ title: 'Greetings', body: '[video:media-1]', cues: CUES });

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 6, configurable: true });
    fireEvent.timeUpdate(video);

    expect(screen.getAllByText('Ha det!')).toHaveLength(2);
    expect(screen.queryByText('Hi!')).not.toBeInTheDocument();
  });
});
