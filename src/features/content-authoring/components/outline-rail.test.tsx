import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  ContainerPublishState,
  CurriculumTree as CurriculumTreeData,
} from '@/features/content/types';

vi.mock('../actions/section', () => ({ createSectionAction: vi.fn() }));

const { OutlineRail } = await import('./outline-rail');
const { createSectionAction } = await import('../actions/section');

function makeTree(levels: { id: string; title: string; modules: ContainerPublishState[] }[]) {
  return {
    versionId: 'version-1',
    containerId: 'course-1',
    levelSystem: 'cefr',
    publishState: 'published',
    containerType: 'course' as const,
    ungroupedItems: [],
    levels: levels.map((level, li) => ({
      id: level.id,
      title: level.title,
      position: li,
      items: [],
      modules: level.modules.map((publishState, mi) => ({
        id: `${level.id}-item-${mi}`,
        containerId: `${level.id}-module-${mi}`,
        versionId: `${level.id}-version-${mi}`,
        title: `Module ${mi}`,
        titleEn: null,
        position: mi,
        isRequired: true,
        publishState,
        sections: [],
        ungroupedItems: [],
      })),
    })),
  } satisfies CurriculumTreeData;
}

const TREE = makeTree([
  { id: 'level-1', title: 'Arbeidsliv', modules: ['published'] },
  { id: 'level-2', title: 'Utdanning', modules: ['published', 'pending_changes'] },
]);

function renderRail(tree: CurriculumTreeData = TREE, selectedId: string | null = null) {
  const onExpand = vi.fn();
  const onSelectLevel = vi.fn();
  const onChanged = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <OutlineRail
        tree={tree}
        courseContainerId="course-1"
        selectedId={selectedId}
        onExpand={onExpand}
        onSelectLevel={onSelectLevel}
        onChanged={onChanged}
      />
    </NextIntlClientProvider>,
  );
  return { onExpand, onSelectLevel, onChanged };
}

beforeEach(() => vi.mocked(createSectionAction).mockReset());

describe('OutlineRail', () => {
  it('lists every level in order', () => {
    renderRail();
    expect(screen.getByText('Arbeidsliv')).toBeInTheDocument();
    expect(screen.getByText('Utdanning')).toBeInTheDocument();
  });

  // The badge already carries the number, so repeating "Leksjon 1 —" in the
  // label spends the width the topic itself needs.
  it('labels a level by its topic, without the numbered prefix', () => {
    renderRail(makeTree([{ id: 'level-1', title: 'Leksjon 1 — Arbeidsliv', modules: [] }]));
    expect(screen.getByText('Arbeidsliv')).toBeInTheDocument();
    expect(screen.queryByText(/Leksjon 1/)).not.toBeInTheDocument();
  });

  // The dot has to agree with the metric strip and the publish dialog, so it is
  // derived from module publish states rather than from anything rail-local.
  it('dots only the levels holding a module students cannot see', () => {
    renderRail();
    const dots = screen.getAllByLabelText('Has unpublished changes');
    expect(dots).toHaveLength(1);
    expect(screen.getByText('Utdanning').closest('button')).toContainElement(dots[0]!);
  });

  it('unfolds the level and selects it when jumped to', () => {
    const { onExpand, onSelectLevel } = renderRail();
    fireEvent.click(screen.getByText('Arbeidsliv'));
    expect(onExpand).toHaveBeenCalledWith('level:level-1');
    expect(onSelectLevel).toHaveBeenCalledWith('level-1');
  });

  it('creates a level and reports it for selection', async () => {
    vi.mocked(createSectionAction).mockResolvedValue({
      ok: true,
      value: { sectionId: 'level-3', position: 2 },
    } as never);
    const { onChanged } = renderRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('level-3', 'level'));
    expect(createSectionAction).toHaveBeenCalledWith('course-1', 'New level');
  });

  it('reports no change when creating a level fails', async () => {
    vi.mocked(createSectionAction).mockResolvedValue({
      ok: false,
      error: { code: 'validation' },
    } as never);
    const { onChanged } = renderRail();

    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));

    await waitFor(() => expect(createSectionAction).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('tells the author the course has no levels yet', () => {
    renderRail(makeTree([]));
    expect(screen.getByText('No levels yet.')).toBeInTheDocument();
  });
});
