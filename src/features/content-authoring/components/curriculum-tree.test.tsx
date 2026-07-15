import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { CurriculumTree as CurriculumTreeData } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';

vi.mock('../actions/container-item', () => ({
  reorderContainerItemsAction: vi.fn(),
  assignItemSectionAction: vi.fn(),
}));
vi.mock('./add-lesson-picker', () => ({ AddLessonPicker: () => null }));

const { CurriculumTree } = await import('./curriculum-tree');

const TREE: CurriculumTreeData = {
  versionId: 'version-1',
  containerId: 'course-1',
  levelSystem: 'cefr',
  levels: [
    {
      id: 'level-a1',
      title: 'A1 — Beginner',
      position: 0,
      modules: [
        {
          id: 'item-module-1',
          containerId: 'module-1',
          versionId: 'module-version-1',
          title: 'Samfunn og kultur',
          titleEn: 'Society and culture',
          position: 0,
          isRequired: true,
          sections: [
            {
              id: 'section-1',
              title: 'Reinforce & read',
              position: 0,
              items: [
                {
                  id: 'item-1',
                  itemType: 'lesson',
                  refId: 'lesson-1',
                  title: 'En vanlig arbeidsdag',
                  position: 0,
                  isRequired: true,
                  lessonKind: 'text',
                  state: 'published',
                  durationMinutes: 6,
                  xpReward: 10,
                },
              ],
            },
          ],
          ungroupedItems: [],
        },
      ],
    },
  ],
};

function renderTree(onSelect = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CurriculumTree
        tree={TREE}
        selectedId={null}
        onSelect={onSelect}
        onChanged={vi.fn()}
        targetLanguage="no"
        difficultyLevel="A2"
        visibility="public"
      />
    </NextIntlClientProvider>,
  );
  return onSelect;
}

describe('CurriculumTree', () => {
  it('renders the level, its module, and section items', () => {
    renderTree();
    expect(screen.getByText('A1 — Beginner')).toBeInTheDocument();
    expect(screen.getByText('Samfunn og kultur')).toBeInTheDocument();
    // Rendered twice: once as the section header, once as the current value of
    // each item's "move to section" select.
    expect(screen.getAllByText('Reinforce & read').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
  });

  it('selects the level on click', () => {
    const onSelect = renderTree();
    fireEvent.click(screen.getByText('A1 — Beginner'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'level', level: expect.objectContaining({ id: 'level-a1' }) }),
    );
  });

  it('selects the module on click', () => {
    const onSelect = renderTree();
    fireEvent.click(screen.getByText('Samfunn og kultur'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'module', module: expect.objectContaining({ id: 'item-module-1' }) }),
    );
  });

  it('selects a lesson item and reports its section title', () => {
    const onSelect = renderTree();
    fireEvent.click(screen.getByText('En vanlig arbeidsdag'));
    const call = onSelect.mock.calls[0]?.[0] as CurriculumTreeSelection;
    expect(call.kind).toBe('item');
    if (call.kind === 'item') {
      expect(call.item.id).toBe('item-1');
      expect(call.sectionTitle).toBe('Reinforce & read');
    }
  });

  it('collapses a level so its modules are no longer rendered', () => {
    renderTree();
    const [levelToggle] = screen.getAllByRole('button', { name: 'Collapse' });
    fireEvent.click(levelToggle!);
    expect(screen.queryByText('Samfunn og kultur')).not.toBeInTheDocument();
  });

  it('shows the "no lessons yet" placeholder for an empty section', () => {
    const [level] = TREE.levels;
    const [module_] = level!.modules;
    const emptyTree: CurriculumTreeData = {
      ...TREE,
      levels: [
        {
          ...level!,
          modules: [
            {
              ...module_!,
              sections: [{ id: 'section-2', title: 'Empty section', position: 0, items: [] }],
            },
          ],
        },
      ],
    };
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CurriculumTree
          tree={emptyTree}
          selectedId={null}
          onSelect={vi.fn()}
          onChanged={vi.fn()}
          targetLanguage="no"
          difficultyLevel="A2"
          visibility="public"
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('No lessons yet')).toBeInTheDocument();
  });
});
