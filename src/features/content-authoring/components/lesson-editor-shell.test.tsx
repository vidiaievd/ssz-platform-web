import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

// The top bar's back link. `next-intl`'s navigation helpers reach for the Next
// router, which a component test has no business booting.
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { LessonEditorShell } = await import('./lesson-editor-shell');

function renderShell() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LessonEditorShell
        kind="exercise"
        title="Match Pairs"
        state="draft"
        isLive={false}
        backHref="/school/x/content/1"
        breadcrumb={<nav aria-label="Breadcrumb">Courses / 1A / Match Pairs</nav>}
        saveStatus="idle"
        savedAt={null}
        publishSlot={null}
        preview={<p>the student view</p>}
      >
        <p>the fields</p>
      </LessonEditorShell>
    </NextIntlClientProvider>,
  );
}

describe('LessonEditorShell — preview device', () => {
  it('starts on the phone, the screen an author cannot check for themselves', () => {
    renderShell();

    expect(screen.getByLabelText('Student preview, phone')).toBeInTheDocument();
    expect(screen.queryByLabelText('Student preview, desktop')).not.toBeInTheDocument();
  });

  it('switches the preview to a desktop-width frame, and back', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('radio', { name: 'Desktop' }));
    expect(screen.getByLabelText('Student preview, desktop')).toBeInTheDocument();
    expect(screen.queryByLabelText('Student preview, phone')).not.toBeInTheDocument();
    // The same preview either way — the frame changes, not what is being previewed.
    expect(screen.getByText('the student view')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Phone' }));
    expect(screen.getByLabelText('Student preview, phone')).toBeInTheDocument();
  });

  it('hiding the preview takes the device switch with it', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Hide preview' }));

    expect(screen.queryByLabelText('Student preview, phone')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Desktop' })).not.toBeInTheDocument();
    expect(screen.getByText('the fields')).toBeInTheDocument();
  });
});

describe('LessonEditorShell — top bar', () => {
  it('carries the page’s breadcrumb rather than repeating the title under it', () => {
    renderShell();

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    // The last crumb is the material's name; a heading saying it again is what made
    // the top of the screen three strips deep.
    expect(screen.queryByRole('heading', { name: 'Match Pairs' })).not.toBeInTheDocument();
  });

  it('leads back to where the material is placed', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'Back to content' })).toHaveAttribute(
      'href',
      '/school/x/content/1',
    );
  });
});
