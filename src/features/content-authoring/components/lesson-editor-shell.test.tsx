import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { LessonEditorShell } from './lesson-editor-shell';

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
