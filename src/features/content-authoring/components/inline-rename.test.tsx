import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InlineRename } from './inline-rename';

function renderRename(value: string, editing: boolean, onCommit = vi.fn()) {
  return render(
    <InlineRename value={value} editing={editing} onCommit={onCommit} onCancel={vi.fn()}>
      <span>{value}</span>
    </InlineRename>,
  );
}

describe('InlineRename', () => {
  // The title can change while the row is not being edited — the inspector
  // renames the same entity. The next edit has to start from the new title, or
  // the blur that commits writes the old one back.
  it('opens on the title as it is now, not as it was first rendered', () => {
    const onCommit = vi.fn();
    const { rerender } = renderRename('Multiple Choice', false, onCommit);

    const next = (editing: boolean) => (
      <InlineRename
        value="Velg riktig form"
        editing={editing}
        onCommit={onCommit}
        onCancel={vi.fn()}
      >
        <span>Velg riktig form</span>
      </InlineRename>
    );
    rerender(next(false));
    rerender(next(true));

    const input = screen.getByDisplayValue('Velg riktig form');
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits a changed title on Enter', () => {
    const onCommit = vi.fn();
    renderRename('Gap fill', true, onCommit);

    const input = screen.getByDisplayValue('Gap fill');
    fireEvent.change(input, { target: { value: '  Kjønn  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('Kjønn');
  });
});
