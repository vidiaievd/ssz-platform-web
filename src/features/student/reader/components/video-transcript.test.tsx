import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonVideoCue } from '@/features/content/types';

import { buildGlossaryIndex } from '@/features/learning';

import { VideoTranscript } from './video-transcript';

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
  { position: 0, startSeconds: 0, targetLine: 'Hei, kan du fortelle om jobben din?', translationLine: 'Hi, can you tell me about your job?' },
  { position: 1, startSeconds: 10, targetLine: 'Jeg jobber som sykepleier.', translationLine: 'I work as a nurse.' },
  { position: 2, startSeconds: 20, targetLine: 'Takk for praten!', translationLine: 'Thanks for the chat!' },
];

function renderTranscript(props: Partial<React.ComponentProps<typeof VideoTranscript>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VideoTranscript
        cues={CUES}
        currentTime={10}
        glossary={buildGlossaryIndex([])}
        targetLang="nb"
        showTranslation={false}
        onJump={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('VideoTranscript', () => {
  it('shows the empty state when there are no cues', () => {
    renderTranscript({ cues: [] });
    expect(screen.getByText('This lesson has no transcript yet.')).toBeInTheDocument();
  });

  it('highlights the active line for the current time', () => {
    renderTranscript({ currentTime: 10 });
    const activeLine = screen.getByText('Jeg jobber som sykepleier.').closest('[role="button"]');
    expect(activeLine).toHaveClass('border-(--ssz-color-primary-500)');
  });

  it('calls onJump with the cue start time when a line is clicked', () => {
    const onJump = vi.fn();
    renderTranscript({ onJump });
    fireEvent.click(screen.getByText('Takk for praten!'));
    expect(onJump).toHaveBeenCalledWith(20);
  });

  it('hides translations by default and shows them when showTranslation is true', () => {
    const { rerender } = renderTranscript({ showTranslation: false });
    expect(screen.queryByText('I work as a nurse.')).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <VideoTranscript
          cues={CUES}
          currentTime={10}
          glossary={buildGlossaryIndex([])}
          targetLang="nb"
          showTranslation
          onJump={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('I work as a nurse.')).toBeInTheDocument();
  });
});
