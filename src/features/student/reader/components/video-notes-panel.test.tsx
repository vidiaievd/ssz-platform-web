import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { VideoNotesPanel } from './video-notes-panel';
import { useVideoNotesStore } from '../stores/video-notes-store';

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

function renderPanel(props: Partial<React.ComponentProps<typeof VideoNotesPanel>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VideoNotesPanel lessonId="lesson-1" currentTime={18.9} {...props} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  useVideoNotesStore.setState({ notesByLesson: {} });
  window.localStorage.clear();
});

describe('VideoNotesPanel', () => {
  it('shows the empty state with no notes', () => {
    renderPanel();
    expect(screen.getByText('No notes yet. Bookmark a moment to remember it.')).toBeInTheDocument();
  });

  it('adds a note stamped at the floored current time via the add button', () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText('Add a note at this moment…'), {
      target: { value: 'blodprøver = blood samples' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    expect(screen.getByText('blodprøver = blood samples')).toBeInTheDocument();
    expect(screen.getByText('0:18')).toBeInTheDocument();
  });

  it('adds a note on Enter and clears the draft', () => {
    renderPanel();
    const input = screen.getByPlaceholderText('Add a note at this moment…');
    fireEvent.change(input, { target: { value: 'note via enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('note via enter')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('does not add a blank note', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByText('No notes yet. Bookmark a moment to remember it.')).toBeInTheDocument();
  });

  it('scopes notes per lesson', () => {
    useVideoNotesStore.getState().addNote('other-lesson', 5, 'not this lesson');
    renderPanel();
    expect(screen.queryByText('not this lesson')).not.toBeInTheDocument();
  });
});
