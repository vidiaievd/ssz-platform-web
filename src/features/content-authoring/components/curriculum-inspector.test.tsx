import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { CurriculumTreeItemNode, CurriculumTreeModuleNode } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';

vi.mock('../actions/container', () => ({
  renameContainerAction: vi.fn(),
  setContainerTitleEnAction: vi.fn(),
}));
vi.mock('../actions/section', () => ({ renameSectionAction: vi.fn() }));
// Pulls in the publish server action, which cannot be imported client-side.
vi.mock('./module-publish-block', () => ({ ModulePublishBlock: () => null }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CurriculumInspector } = await import('./curriculum-inspector');
const { renameContainerAction, setContainerTitleEnAction } = await import('../actions/container');
const { renameSectionAction } = await import('../actions/section');

function renderInspector(
  selection: CurriculumTreeSelection | null,
  onChanged = vi.fn(),
  onDelete = vi.fn(),
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CurriculumInspector
        selection={selection}
        courseContainerId="course-1"
        schoolSlug="my-school"
        onChanged={onChanged}
        onDelete={onDelete}
      />
    </NextIntlClientProvider>,
  );
  return onChanged;
}

function moduleNode(overrides: Partial<CurriculumTreeModuleNode> = {}): CurriculumTreeModuleNode {
  return {
    id: 'item-module-1',
    containerId: 'module-1',
    versionId: 'module-version-1',
    title: 'Samfunn og kultur',
    titleEn: null,
    position: 0,
    isRequired: true,
    sections: [],
    publishState: 'draft',
    ungroupedItems: [],
    ...overrides,
  };
}

function itemNode(overrides: Partial<CurriculumTreeItemNode> = {}): CurriculumTreeItemNode {
  return {
    id: 'item-1',
    itemType: 'lesson',
    refId: 'lesson-1',
    title: 'En vanlig arbeidsdag',
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

beforeEach(() => {
  vi.mocked(renameContainerAction).mockReset();
  vi.mocked(renameSectionAction).mockReset();
  vi.mocked(setContainerTitleEnAction).mockReset();
});

describe('CurriculumInspector', () => {
  it('shows the empty-selection prompt when nothing is selected', () => {
    renderInspector(null);
    expect(
      screen.getByText('Select an item to inspect and edit its settings.'),
    ).toBeInTheDocument();
  });

  it('shows level contextual help with an editable title', () => {
    renderInspector({
      kind: 'level',
      level: { id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [], items: [] },
    });
    expect(screen.getByDisplayValue('A1 — Beginner')).toBeInTheDocument();
    expect(
      screen.getByText('Levels group modules and map to CEFR bands students see in the reader.'),
    ).toBeInTheDocument();
  });

  it('shows a plain (non-editable) title for the single-level placeholder (no level id)', () => {
    renderInspector({
      kind: 'level',
      level: { id: null, title: 'All content', position: 0, modules: [], items: [] },
    });
    expect(screen.getByText('All content')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows module title and its editable English subtitle', () => {
    renderInspector({ kind: 'module', module: moduleNode({ titleEn: 'Society and culture' }) });
    expect(screen.getByDisplayValue('Samfunn og kultur')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Society and culture')).toBeInTheDocument();
  });

  it("sums a module's blocks into an estimated duration, and counts them", () => {
    renderInspector({
      kind: 'module',
      module: moduleNode({
        sections: [
          {
            id: 'section-1',
            title: 'Read',
            position: 0,
            items: [itemNode({ id: 'i-1', durationMinutes: 6 })],
          },
        ],
        ungroupedItems: [itemNode({ id: 'i-2', durationMinutes: 4 })],
      }),
    });

    expect(screen.getByText('10 min')).toBeInTheDocument();
    // Two blocks across one section plus the ungrouped bucket.
    expect(screen.getByText('Blocks').parentElement).toHaveTextContent('2');
  });

  it('offers the fields the backend cannot store yet without letting them be edited', () => {
    renderInspector({ kind: 'module', module: moduleNode() });

    const goals = screen.getByLabelText('Learning goals — not available yet');
    expect(goals).toHaveAttribute('aria-disabled', 'true');
    expect(goals.tagName).not.toBe('INPUT');
    expect(screen.getByLabelText('Homework by default — not available yet')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it("deletes the selected module through the panel's confirmation", () => {
    const onDelete = vi.fn();
    renderInspector(
      { kind: 'module', module: moduleNode({ ungroupedItems: [itemNode({ id: 'i-1' })] }) },
      vi.fn(),
      onDelete,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith({
      kind: 'module',
      id: 'item-module-1',
      title: 'Samfunn og kultur',
      blockCount: 1,
    });
  });

  it('shows lesson metadata: type label, duration, xp and state', () => {
    renderInspector({
      kind: 'item',
      sectionTitle: 'Reinforce & read',
      item: {
        id: 'item-1',
        itemType: 'lesson',
        refId: 'lesson-1',
        title: 'En vanlig arbeidsdag',
        position: 0,
        isRequired: true,
        lessonKind: 'text',
        state: 'published',
        isLive: true,
        pendingChange: null,
        durationMinutes: 6,
        xpReward: 10,
      },
    });
    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Students see this')).toBeInTheDocument();
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
  });

  it('says an item is awaiting publish when the live version does not place it', () => {
    renderInspector({
      kind: 'item',
      sectionTitle: 'Reinforce & read',
      item: {
        id: 'item-1',
        itemType: 'lesson',
        refId: 'lesson-1',
        title: 'En vanlig arbeidsdag',
        position: 0,
        isRequired: true,
        lessonKind: 'text',
        // Variant published, item not live: exactly the case the old badge lied about.
        state: 'published',
        isLive: false,
        pendingChange: null,
        durationMinutes: 6,
        xpReward: 10,
      },
    });

    expect(screen.getByText('Awaiting publish')).toBeInTheDocument();
    expect(screen.queryByText('Students see this')).not.toBeInTheDocument();
  });

  it('shows a placeholder dash for missing duration/xp', () => {
    renderInspector({
      kind: 'item',
      sectionTitle: null,
      item: {
        id: 'item-2',
        itemType: 'vocabulary_list',
        refId: 'vocab-1',
        title: 'Ord 1',
        position: 0,
        isRequired: true,
        lessonKind: null,
        state: null,
        isLive: false,
        pendingChange: null,
        durationMinutes: null,
        xpReward: null,
      },
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  describe('renaming', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('renames a level when save is pressed and reports the change', async () => {
      vi.mocked(renameSectionAction).mockResolvedValue({ ok: true, value: undefined } as never);
      const onChanged = renderInspector({
        kind: 'level',
        level: { id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [], items: [] },
      });

      fireEvent.change(screen.getByDisplayValue('A1 — Beginner'), {
        target: { value: 'A1 — Nybegynner' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });

      expect(renameSectionAction).toHaveBeenCalledWith('course-1', 'level-a1', 'A1 — Nybegynner');
      expect(onChanged).toHaveBeenCalled();
    });

    it('renames a module when save is pressed and reports the change', async () => {
      vi.mocked(renameContainerAction).mockResolvedValue({ ok: true, value: undefined } as never);
      const onChanged = renderInspector({ kind: 'module', module: moduleNode() });

      fireEvent.change(screen.getByDisplayValue('Samfunn og kultur'), {
        target: { value: 'Samfunn' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });

      expect(renameContainerAction).toHaveBeenCalledWith('module-1', 'Samfunn');
      expect(onChanged).toHaveBeenCalled();
    });

    it('creates the English subtitle when the module has none', async () => {
      vi.mocked(setContainerTitleEnAction).mockResolvedValue({
        ok: true,
        value: undefined,
      } as never);
      renderInspector({ kind: 'module', module: moduleNode({ titleEn: null }) });

      fireEvent.change(screen.getByLabelText('Title (English)'), {
        target: { value: 'Society and culture' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save subtitle' }));
      });

      // `false` is the create-vs-update decision: the tree reports null when no
      // localization row exists for the module.
      expect(setContainerTitleEnAction).toHaveBeenCalledWith(
        'module-1',
        'Society and culture',
        false,
      );
    });
  });
});
