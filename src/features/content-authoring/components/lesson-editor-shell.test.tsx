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
const { EditorToolbarPortal } = await import('./editor-toolbar');

function renderShell() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LessonEditorShell
        kind="exercise"
        title="Match Pairs"
        state="draft"
        isLive={false}
        backHref="/school/x/content/1"
        saveStatus="idle"
        savedAt={null}
        publishSlot={null}
        preview={<p>the student view</p>}
      >
        <EditorToolbarPortal>
          <div role="tablist" aria-label="Steps">
            <button role="tab">1 Pairs</button>
          </div>
        </EditorToolbarPortal>
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
  it('names the material for a screen reader without printing it twice', () => {
    renderShell();

    // The visible name is the breadcrumb in the app's bar; a page still needs a
    // heading, and a second copy of the title in the workspace bar is what made the
    // top of this screen three strips deep.
    expect(screen.getByRole('heading', { name: 'Match Pairs' })).toHaveClass('sr-only');
  });

  it('leads back to where the material is placed', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'Back to content' })).toHaveAttribute(
      'href',
      '/school/x/content/1',
    );
  });
});

describe('LessonEditorShell — the builder’s toolbar', () => {
  it('takes the builder’s steps into the workspace bar, out of the scrolling column', () => {
    renderShell();

    const steps = screen.getByRole('tablist', { name: 'Steps' });
    // In the bar beside the material's badges rather than inside the editor column:
    // the bar is what lines up with the preview panel next to it.
    const bar = screen.getByText('Practice').closest('div')?.parentElement;
    expect(bar).toContainElement(steps);
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Hide preview' }));
  });
});
