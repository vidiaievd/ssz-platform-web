import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonVideoCue } from '@/features/content/types';

import { buildGlossaryIndex } from '@/features/learning';

import { VideoPlayer, type VideoPlayerHandle } from './video-player';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const CUES: LessonVideoCue[] = [
  { position: 0, startSeconds: 0, targetLine: 'Hei, kan du fortelle om jobben din?', translationLine: null },
  { position: 1, startSeconds: 10, targetLine: 'Jeg jobber som sykepleier.', translationLine: null },
];

function renderPlayer(
  props: Partial<React.ComponentProps<typeof VideoPlayer>> = {},
  ref?: React.Ref<VideoPlayerHandle>,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VideoPlayer
        ref={ref}
        src="https://cdn.test/video.mp4"
        label="Intervju på jobben"
        cues={CUES}
        glossary={buildGlossaryIndex([])}
        targetLang="nb"
        showSubtitles
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VideoPlayer', () => {
  it('shows the empty state when there is no source', () => {
    renderPlayer({ src: undefined });
    expect(screen.getByText("This lesson doesn't have a video yet.")).toBeInTheDocument();
  });

  it('toggles play/pause via the center button', () => {
    renderPlayer();
    const playButtons = screen.getAllByRole('button', { name: 'Play' });
    fireEvent.click(playButtons[0]!);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('shows the active cue as a subtitle overlay once its start time has passed', () => {
    const { container } = renderPlayer();
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 10, writable: true });
    fireEvent.timeUpdate(video);
    expect(screen.getByText('Jeg jobber som sykepleier.')).toBeInTheDocument();
  });

  it('hides subtitles when showSubtitles is false', () => {
    const { container } = renderPlayer({ showSubtitles: false });
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 10, writable: true });
    fireEvent.timeUpdate(video);
    expect(screen.queryByText('Jeg jobber som sykepleier.')).not.toBeInTheDocument();
  });

  it('exposes seekTo via ref, updating the video currentTime and resuming playback', () => {
    const ref = createRef<VideoPlayerHandle>();
    const { container } = renderPlayer({}, ref);
    const video = container.querySelector('video') as HTMLVideoElement;
    ref.current?.seekTo(10);
    expect(video.currentTime).toBe(10);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
