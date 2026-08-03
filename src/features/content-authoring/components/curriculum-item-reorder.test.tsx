import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeLevelNode,
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

const {
  computeReorderedItemIds,
  computeReorderedModuleIds,
  MoveToSectionSelect,
  MoveLevel,
  MoveModule,
  MoveSection,
} = await import('./curriculum-item-reorder');
import { assignItemSectionAction, reorderContainerItemsAction } from '../actions/container-item';
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

    await waitFor(() =>
      expect(assignItemSectionAction).toHaveBeenCalledWith('module-1', 'a1', 'section-b'),
    );
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

function module_(id: string, position: number): CurriculumTreeModuleNode {
  return {
    id,
    containerId: `container-${id}`,
    versionId: `version-${id}`,
    title: id,
    titleEn: null,
    position,
    isRequired: true,
    sections: [],
    publishState: 'draft',
    ungroupedItems: [],
  };
}

const LEVEL_A1: CurriculumTreeLevelNode = {
  id: 'level-a1',
  title: 'A1',
  position: 0,
  items: [],
  modules: [module_('m1', 0), module_('m2', 1)],
};
const LEVEL_A2: CurriculumTreeLevelNode = {
  id: 'level-a2',
  title: 'A2',
  position: 1,
  items: [],
  modules: [module_('m3', 0)],
};
const TREE: CurriculumTree = {
  versionId: 'version-1',
  containerId: 'course-1',
  publishState: 'draft',
  levelSystem: 'cefr',
  containerType: 'course' as const,
  ungroupedItems: [],
  levels: [LEVEL_A1, LEVEL_A2],
};

describe('computeReorderedModuleIds', () => {
  it('keeps other levels untouched when reordering modules within one level', () => {
    const [m1, m2] = LEVEL_A1.modules;
    const reordered = [m2!, m1!];
    expect(computeReorderedModuleIds(TREE, reordered)).toEqual(['m2', 'm1', 'm3']);
  });
});

describe('MoveLevel', () => {
  beforeEach(() => vi.mocked(reorderSectionsAction).mockReset());

  it('moves the level down and submits the new order', async () => {
    vi.mocked(reorderSectionsAction).mockResolvedValue({ ok: true, value: undefined } as never);
    const onMoved = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MoveLevel
          courseContainerId="course-1"
          levels={TREE.levels}
          level={LEVEL_A1}
          onMoved={onMoved}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move Level down' }));

    await waitFor(() =>
      expect(reorderSectionsAction).toHaveBeenCalledWith('course-1', ['level-a2', 'level-a1']),
    );
    expect(onMoved).toHaveBeenCalled();
  });

  it('disables "move up" for the first level and "move down" for the last', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MoveLevel
          courseContainerId="course-1"
          levels={TREE.levels}
          level={LEVEL_A1}
          onMoved={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Move Level up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Level down' })).not.toBeDisabled();
  });
});

describe('MoveModule', () => {
  beforeEach(() => vi.mocked(reorderContainerItemsAction).mockReset());

  it('moves a module up within its level and submits the full course order', async () => {
    vi.mocked(reorderContainerItemsAction).mockResolvedValue({
      ok: true,
      value: undefined,
    } as never);
    const onMoved = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MoveModule
          courseContainerId="course-1"
          tree={TREE}
          level={LEVEL_A1}
          module={LEVEL_A1.modules[1]!}
          onMoved={onMoved}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move Module up' }));

    await waitFor(() =>
      expect(reorderContainerItemsAction).toHaveBeenCalledWith('course-1', ['m2', 'm1', 'm3']),
    );
    expect(onMoved).toHaveBeenCalled();
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
