import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { StructureUndoProvider, useStructureUndo } from './use-structure-undo';

function Editor({ revert }: { revert: () => Promise<boolean> }) {
  const undo = useStructureUndo();
  return (
    <>
      <button onClick={() => undo.record({ label: 'Moved “Leksjon 17”.', revert })}>edit</button>
      <input aria-label="title" />
      <span data-testid="can-undo">{String(undo.canUndo)}</span>
    </>
  );
}

function renderEditor(revert: () => Promise<boolean>) {
  const onChanged = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StructureUndoProvider onChanged={onChanged}>
        <Editor revert={revert} />
      </StructureUndoProvider>
    </NextIntlClientProvider>,
  );
  return onChanged;
}

function pressUndo(target: Element | Document = document) {
  fireEvent.keyDown(target, { key: 'z', metaKey: true });
}

describe('StructureUndoProvider', () => {
  it('reverts the last edit on ⌘Z and reloads the tree', async () => {
    const revert = vi.fn().mockResolvedValue(true);
    const onChanged = renderEditor(revert);

    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByTestId('can-undo')).toHaveTextContent('true');

    await act(async () => {
      pressUndo();
    });

    expect(revert).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    // The edit is spent: pressing again must not send the same request twice.
    expect(screen.getByTestId('can-undo')).toHaveTextContent('false');
  });

  it('leaves ⌘Z to the field being typed in', async () => {
    const revert = vi.fn().mockResolvedValue(true);
    renderEditor(revert);
    fireEvent.click(screen.getByText('edit'));

    await act(async () => {
      pressUndo(screen.getByLabelText('title'));
    });

    expect(revert).not.toHaveBeenCalled();
  });

  it('keeps the edit undoable when the server refuses to revert it', async () => {
    const revert = vi.fn().mockResolvedValue(false);
    const onChanged = renderEditor(revert);
    fireEvent.click(screen.getByText('edit'));

    await act(async () => {
      pressUndo();
    });

    expect(revert).toHaveBeenCalledTimes(1);
    // Nothing was put back, so there is nothing to reload.
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('does nothing when there is no edit to undo', async () => {
    const revert = vi.fn().mockResolvedValue(true);
    renderEditor(revert);

    await act(async () => {
      pressUndo();
    });

    expect(revert).not.toHaveBeenCalled();
  });
});
