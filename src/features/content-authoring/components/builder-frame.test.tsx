import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from './builder-frame';

function wrap(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('BuilderSaveHint', () => {
  it('says nothing before the first save', () => {
    const { container } = wrap(<BuilderSaveHint status="idle" savedAt={null} />);

    expect(container.textContent).toBe('');
  });

  it('announces saving and saved politely', () => {
    const { rerender } = wrap(<BuilderSaveHint status="saving" savedAt={null} />);

    expect(screen.getByText('Saving…')).toHaveAttribute('aria-live', 'polite');

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BuilderSaveHint status="saved" savedAt={new Date('2026-08-22T10:00:00Z')} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/Saved at/)).toBeInTheDocument();
  });

  it('stays silent about a save that did not work', () => {
    // The bar shares its line with a step rail, so a sentence here is a sentence that
    // squeezes the rail off the screen. Failures are raised as a toast or a dialog.
    for (const status of ['failed', 'rejected', 'conflict'] as const) {
      const { container, unmount } = wrap(<BuilderSaveHint status={status} savedAt={null} />);
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});

describe('BuilderStepNav', () => {
  const labels = ['', 'The task', 'The frame', 'Marking', 'Flow'];

  it('has nowhere back from the first step', () => {
    wrap(
      <BuilderStepNav
        current={1}
        last={4}
        stepLabel={(n) => labels[n]!}
        onSelect={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next: The frame' })).toBeEnabled();
  });

  it('ends in the gate rather than a fifth step', async () => {
    const onDone = vi.fn();
    const onSelect = vi.fn();
    wrap(
      <BuilderStepNav
        current={4}
        last={4}
        stepLabel={(n) => labels[n]!}
        onSelect={onSelect}
        onDone={onDone}
      />,
    );

    expect(screen.queryByRole('button', { name: /Next:/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review & finish' }));

    expect(onDone).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('BuilderGateDialog', () => {
  const rows: GateRow[] = [
    { key: 'b1', level: 'blocker', text: 'Write the task itself.', step: 1 },
    { key: 'w1', level: 'warning', text: 'No example answer.', step: 3 },
  ];

  it('lists what is in the way and refuses to finish while a blocker stands', () => {
    wrap(<BuilderGateDialog open rows={rows} onOpenChange={vi.fn()} onGoToStep={vi.fn()} />);

    expect(screen.getByText('Write the task itself.')).toBeInTheDocument();
    expect(screen.getByText('No example answer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fix 1 problem first' })).toBeDisabled();
  });

  it('finishes when only warnings are left', () => {
    wrap(
      <BuilderGateDialog open rows={rows.slice(1)} onOpenChange={vi.fn()} onGoToStep={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });

  it('sends the teacher to the step that fixes the row they picked', async () => {
    const onGoToStep = vi.fn();
    wrap(<BuilderGateDialog open rows={rows} onOpenChange={vi.fn()} onGoToStep={onGoToStep} />);

    await userEvent.click(screen.getByText('No example answer.'));

    expect(onGoToStep).toHaveBeenCalledWith(3);
  });

  it('says so plainly when nothing stands in the way', () => {
    wrap(<BuilderGateDialog open rows={[]} onOpenChange={vi.fn()} onGoToStep={vi.fn()} />);

    expect(
      screen.getByText('Nothing standing in the way — this exercise is ready to assign.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });
});
