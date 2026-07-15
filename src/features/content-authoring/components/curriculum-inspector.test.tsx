import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { CurriculumTreeSelection } from '../types';

vi.mock('../actions/container', () => ({ renameContainerAction: vi.fn() }));
vi.mock('../actions/section', () => ({ renameSectionAction: vi.fn() }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CurriculumInspector } = await import('./curriculum-inspector');
const { renameContainerAction } = await import('../actions/container');
const { renameSectionAction } = await import('../actions/section');

function renderInspector(selection: CurriculumTreeSelection | null, onChanged = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CurriculumInspector
        selection={selection}
        courseContainerId="course-1"
        schoolSlug="my-school"
        onChanged={onChanged}
      />
    </NextIntlClientProvider>,
  );
  return onChanged;
}

beforeEach(() => {
  vi.mocked(renameContainerAction).mockReset();
  vi.mocked(renameSectionAction).mockReset();
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
      level: { id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [] },
    });
    expect(screen.getByDisplayValue('A1 — Beginner')).toBeInTheDocument();
    expect(
      screen.getByText('Levels group modules and map to CEFR bands students see in the reader.'),
    ).toBeInTheDocument();
  });

  it('shows a plain (non-editable) title for the single-level placeholder (no level id)', () => {
    renderInspector({
      kind: 'level',
      level: { id: null, title: 'All content', position: 0, modules: [] },
    });
    expect(screen.getByText('All content')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows module title (English) when present, with an editable title', () => {
    renderInspector({
      kind: 'module',
      module: {
        id: 'item-module-1',
        containerId: 'module-1',
        versionId: 'module-version-1',
        title: 'Samfunn og kultur',
        titleEn: 'Society and culture',
        position: 0,
        isRequired: true,
        sections: [],
        ungroupedItems: [],
      },
    });
    expect(screen.getByDisplayValue('Samfunn og kultur')).toBeInTheDocument();
    expect(screen.getByText('Society and culture')).toBeInTheDocument();
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
        durationMinutes: 6,
        xpReward: 10,
      },
    });
    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
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
        durationMinutes: null,
        xpReward: null,
      },
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  describe('renaming', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('renames a level after the autosave debounce and reports the change', async () => {
      vi.mocked(renameSectionAction).mockResolvedValue({ ok: true, value: undefined } as never);
      const onChanged = renderInspector({
        kind: 'level',
        level: { id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [] },
      });

      fireEvent.change(screen.getByDisplayValue('A1 — Beginner'), {
        target: { value: 'A1 — Nybegynner' },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(renameSectionAction).toHaveBeenCalledWith('course-1', 'level-a1', 'A1 — Nybegynner');
      expect(onChanged).toHaveBeenCalled();
    });

    it('renames a module after the autosave debounce and reports the change', async () => {
      vi.mocked(renameContainerAction).mockResolvedValue({ ok: true, value: undefined } as never);
      const onChanged = renderInspector({
        kind: 'module',
        module: {
          id: 'item-module-1',
          containerId: 'module-1',
          versionId: 'module-version-1',
          title: 'Samfunn og kultur',
          titleEn: null,
          position: 0,
          isRequired: true,
          sections: [],
          ungroupedItems: [],
        },
      });

      fireEvent.change(screen.getByDisplayValue('Samfunn og kultur'), {
        target: { value: 'Samfunn' },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(renameContainerAction).toHaveBeenCalledWith('module-1', 'Samfunn');
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
