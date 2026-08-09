import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
  CurriculumTreeSectionNode,
} from '@/features/content/types';

vi.mock('../actions/container-item', () => ({
  reorderContainerItemsAction: vi.fn(),
  assignItemSectionAction: vi.fn(),
}));
vi.mock('../actions/section', () => ({ reorderSectionsAction: vi.fn() }));

// jsdom doesn't implement scrollIntoView; Radix Select calls it when opening.
Element.prototype.scrollIntoView = vi.fn();

const { computeReorderedItemIds, MoveSection } = await import('./curriculum-item-reorder');
import { reorderSectionsAction } from '../actions/section';

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
    isLive: true,
    pendingChange: null,
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
    {
      id: 'section-a',
      title: 'Section A',
      position: 0,
      items: [item('a1'), item('a2'), item('a3')],
    },
    { id: 'section-b', title: 'Section B', position: 1, items: [item('b1'), item('b2')] },
  ],
  publishState: 'draft',
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

describe('MoveSection', () => {
  const sectionA: CurriculumTreeSectionNode = {
    id: 'section-a',
    title: 'Section A',
    position: 0,
    items: [],
  };
  const sectionB: CurriculumTreeSectionNode = {
    id: 'section-b',
    title: 'Section B',
    position: 1,
    items: [],
  };

  beforeEach(() => vi.mocked(reorderSectionsAction).mockReset());

  it('moves a section down and submits the new order', async () => {
    vi.mocked(reorderSectionsAction).mockResolvedValue({ ok: true, value: undefined } as never);
    const onMoved = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MoveSection
          moduleContainerId="module-1"
          sections={[sectionA, sectionB]}
          section={sectionA}
          onMoved={onMoved}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move Section A down' }));

    await waitFor(() =>
      expect(reorderSectionsAction).toHaveBeenCalledWith('module-1', ['section-b', 'section-a']),
    );
    expect(onMoved).toHaveBeenCalled();
  });
});
