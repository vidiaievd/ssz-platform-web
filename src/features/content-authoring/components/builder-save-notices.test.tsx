import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

const toast = { error: vi.fn(), dismiss: vi.fn() };
vi.mock('sonner', () => ({ toast }));

const { BuilderConflictDialog, useBuilderSaveNotices } = await import('./builder-save-notices');

/** The hook has no UI of its own; this is the component that runs it. */
function BuilderSaveStatusHarness(props: Parameters<typeof useBuilderSaveNotices>[0]) {
  useBuilderSaveNotices(props);
  return null;
}

function wrap(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBuilderSaveNotices', () => {
  it('rides out the first transient failure without saying anything', () => {
    // The backoff is already retrying it. A notice for every blink is a notice the author
    // learns to dismiss unread — including the one that mattered.
    wrap(
      <BuilderSaveStatusHarness
        status="failed"
        rejection={null}
        failures={1}
        onRetry={vi.fn()}
      />,
    );

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('speaks up when a second failure follows the first', () => {
    wrap(
      <BuilderSaveStatusHarness
        status="failed"
        rejection={null}
        failures={2}
        onRetry={vi.fn()}
      />,
    );

    expect(toast.error).toHaveBeenCalledWith(
      'Save failed — your edits are still here.',
      expect.anything(),
    );
  });

  it('keeps a refusal on screen, with the reason the service gave', async () => {
    const onRetry = vi.fn();
    wrap(
      <BuilderSaveStatusHarness
        status="rejected"
        rejection="INVALID_EXERCISE_ANSWERS: /rubric must be string"
        failures={0}
        onRetry={onRetry}
      />,
    );

    const [, options] = toast.error.mock.calls[0]!;
    expect(options.description).toBe('INVALID_EXERCISE_ANSWERS: /rubric must be string');
    // No retry will change the server's answer, so it does not fade while it is still true.
    expect(options.duration).toBe(Infinity);

    options.action.onClick();
    expect(onRetry).toHaveBeenCalled();
  });

  it('has its own words when the refusal came without a reason', () => {
    wrap(
      <BuilderSaveStatusHarness status="rejected" rejection={null} failures={0} onRetry={vi.fn()} />,
    );

    const [, options] = toast.error.mock.calls[0]!;
    expect(options.description).toBe('The server would not accept this exercise.');
  });

  it('takes the notice down once a save lands', () => {
    wrap(<BuilderSaveStatusHarness status="saved" rejection={null} failures={0} onRetry={vi.fn()} />);

    expect(toast.dismiss).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('BuilderConflictDialog', () => {
  it('offers both answers and no way of answering neither', async () => {
    const onOverwrite = vi.fn();
    const onDiscard = vi.fn();
    wrap(<BuilderConflictDialog open onOverwrite={onOverwrite} onDiscard={onDiscard} />);

    // A dialog that could be waved away would leave an editor that looks normal and
    // writes nothing — the author's work is on screen and unsaved.
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save mine anyway' }));
    expect(onOverwrite).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Reload theirs' }));
    expect(onDiscard).toHaveBeenCalled();
  });
});
