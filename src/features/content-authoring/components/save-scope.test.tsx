import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { SaveScopeProvider } = await import('./save-scope');
const { PanelSaveButton } = await import('./panel-save-button');
const { toast } = await import('sonner');

import { SaveRefusedError, type UseUnsavedChangesReturn } from '../hooks/use-unsaved-changes';

const UNSAVED: UseUnsavedChangesReturn = {
  status: 'idle',
  savedAt: null,
  isDirty: true,
  markDirty: () => {},
  save: () => Promise.resolve(true),
  lastError: () => null,
  markSaved: () => {},
  reset: () => {},
};

function renderButton(scope: { isLive: boolean | null } | null) {
  const button = <PanelSaveButton unsaved={UNSAVED} />;
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {scope ? <SaveScopeProvider isLive={scope.isLive}>{button}</SaveScopeProvider> : button}
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

describe('save scope in a sub-panel', () => {
  beforeEach(() => vi.mocked(toast.success).mockReset());

  it('tells the author a panel save on live material already reached students', async () => {
    renderButton({ isLive: true });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Lesson saved.', {
        description: 'Students see this change now.',
      }),
    );
  });

  it('tells the author a panel save on unreleased material waits for a publish', async () => {
    renderButton({ isLive: false });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Lesson saved.', {
        description: 'Saved to the draft — publish the module to release it.',
      }),
    );
  });

  it('leaves the confirmation alone where nothing states the scope', async () => {
    // A panel used outside an editor cannot claim either reach.
    renderButton(null);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Lesson saved.', { description: undefined }),
    );
  });
});

describe('a refused panel save', () => {
  beforeEach(() => vi.mocked(toast.error).mockReset());

  function clickFailing(lastError: unknown) {
    const unsaved = { ...UNSAVED, save: () => Promise.resolve(false), lastError: () => lastError };
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PanelSaveButton unsaved={unsaved} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('shows the server reason once, not a generic failure on top of it', async () => {
    clickFailing(
      new SaveRefusedError({
        code: 'conflict',
        details: { error: { code: 'SCHOOL_NOT_ACTIVE', status: 'suspended' } },
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toBe(
      enMessages.SchoolLifecycle.errors.schoolSuspended,
    );
  });

  it('falls back to the generic failure when nothing was refused', async () => {
    clickFailing(new Error('invalid'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toBe(enMessages.Authoring.lessons.saveFailed);
  });
});
