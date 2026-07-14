import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

vi.mock('../actions/container-item', () => ({
  reorderContainerItemsAction: vi.fn(),
  assignItemSectionAction: vi.fn(),
}));

// jsdom doesn't implement scrollIntoView; Radix Select calls it when opening.
Element.prototype.scrollIntoView = vi.fn();

const { computeReorderedItemIds, MoveToSectionSelect } = await import('./curriculum-item-reorder');
import { assignItemSectionAction } from '../actions/container-item';

function item(id: string, overrides: Partial<CurriculumTreeItemNode> = {}): CurriculumTreeItemNode {
  return {
    id,
    itemType: 'lesson',
    refId: `ref-${id}`,
    title: id,
    position: 0,
    isRequired: true,
    lessonKind: 'text',
    state: 'published',
    durationMinutes: null,
    xpReward: null,
    ...overrides,
  };
}

const MODULE: CurriculumTreeModuleNode = {
  id: 'item-module-1',
  containerId: 'module-1',
  versionId: 'module-version-1',
  title: 'Module',
  titleEn: null,
  position: 0,
  isRequired: true,
  sections: [
    { id: 'section-a', title: 'Section A', position: 0, items: [item('a1'), item('a2'), item('a3')] },
    { id: 'section-b', title: 'Section B', position: 1, items: [item('b1'), item('b2')] },
  ],
  ungroupedItems: [item('u1')],
};

describe('computeReorderedItemIds', () => {
  it('keeps other sections and ungrouped items untouched when reordering within one section', () => {
    const [a1, a2, a3] = MODULE.sections[0]!.items;
    const reordered = [a3!, a1!, a2!]; // moved a3 to the front
    const result = computeReorderedItemIds(MODULE, reordered);
    expect(result).toEqual(['a3', 'a1', 'a2', 'b1', 'b2', 'u1']);
  });

  it('reorders the second section without disturbing the first or ungrouped items', () => {
    const [b1, b2] = MODULE.sections[1]!.items;
    const reordered = [b2!, b1!];
    const result = computeReorderedItemIds(MODULE, reordered);
    expect(result).toEqual(['a1', 'a2', 'a3', 'b2', 'b1', 'u1']);
  });

  it('covers every item exactly once', () => {
    const [a1, a2, a3] = MODULE.sections[0]!.items;
    const result = computeReorderedItemIds(MODULE, [a2!, a3!, a1!]);
    expect(result.sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'u1'].sort());
  });
});

describe('MoveToSectionSelect', () => {
  beforeEach(() => vi.mocked(assignItemSectionAction).mockReset());

  function renderSelect(onMoved = vi.fn()) {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MoveToSectionSelect
          moduleContainerId="module-1"
          item={item('a1')}
          currentSectionId="section-a"
          sections={[
            { id: 'section-a', title: 'Section A' },
            { id: 'section-b', title: 'Section B' },
          ]}
          onMoved={onMoved}
        />
      </NextIntlClientProvider>,
    );
    return onMoved;
  }

  it('moves the item to the selected section', async () => {
    vi.mocked(assignItemSectionAction).mockResolvedValue({ ok: true, value: undefined });
    const onMoved = renderSelect();

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Section B'));

    await waitFor(() => expect(assignItemSectionAction).toHaveBeenCalledWith('module-1', 'a1', 'section-b'));
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
  });

  it('moves the item out to "no section" (ungrouped)', async () => {
    vi.mocked(assignItemSectionAction).mockResolvedValue({ ok: true, value: undefined });
    renderSelect();

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('No section'));

    await waitFor(() =>
      expect(assignItemSectionAction).toHaveBeenCalledWith('module-1', 'a1', null),
    );
  });

  it('does not call onMoved when the move fails', async () => {
    vi.mocked(assignItemSectionAction).mockResolvedValue({
      ok: false,
      error: { code: 'unknown', message: 'failed' },
    });
    const onMoved = renderSelect();

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Section B'));

    await waitFor(() => expect(assignItemSectionAction).toHaveBeenCalled());
    expect(onMoved).not.toHaveBeenCalled();
  });
});
