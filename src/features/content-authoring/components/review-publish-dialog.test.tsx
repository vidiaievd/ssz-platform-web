import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  Container,
  ContainerPublishState,
  CurriculumTree,
  CurriculumTreeModuleNode,
} from '@/features/content/types';
import type { PreflightResult } from '../types';

vi.mock('../actions/publish-container', () => ({ publishContainerAction: vi.fn() }));
vi.mock('../api/use-curriculum-tree', () => ({ useCurriculumTree: vi.fn() }));
vi.mock('../api/use-containers-preflight', () => ({ useContainersPreflight: vi.fn() }));

const { ReviewPublishDialog } = await import('./review-publish-dialog');
const { collectPublishRows } = await import('../lib/publish-rows');
const { publishContainerAction } = await import('../actions/publish-container');
const { useCurriculumTree } = await import('../api/use-curriculum-tree');
const { useContainersPreflight } = await import('../api/use-containers-preflight');

const COURSE: Container = {
  id: 'course-1',
  slug: 'norwegian-a2',
  title: 'Norwegian A2',
  containerType: 'course',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  visibility: 'public',
  accessTier: 'free_within_school',
  currentPublishedVersionId: 'version-1',
  ownerUserId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeModule(
  containerId: string,
  title: string,
  publishState: ContainerPublishState,
): CurriculumTreeModuleNode {
  return {
    id: `item-${containerId}`,
    containerId,
    versionId: `${containerId}-draft`,
    title,
    titleEn: null,
    position: 0,
    isRequired: true,
    publishState,
    sections: [],
    ungroupedItems: [],
  };
}

function makeTree(
  coursePublishState: ContainerPublishState,
  modules: CurriculumTreeModuleNode[],
): CurriculumTree {
  return {
    versionId: 'course-draft',
    containerId: 'course-1',
    levelSystem: 'cefr',
    publishState: coursePublishState,
    levels: [{ id: 'level-a1', title: 'A1', position: 0, modules }],
  };
}

function preflight(blockerCount = 0, warningCount = 0): PreflightResult {
  return { blockerCount, warningCount, checks: [] } as unknown as PreflightResult;
}

/** Every row gets the same pre-flight verdict. */
function mockPreflight(result: PreflightResult) {
  vi.mocked(useContainersPreflight).mockImplementation(
    (ids: string[]) => new Map(ids.map((id) => [id, { result, isLoading: false }])),
  );
}

function renderDialog(tree: CurriculumTree | undefined) {
  vi.mocked(useCurriculumTree).mockReturnValue({ data: tree, isLoading: false } as never);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReviewPublishDialog
          container={COURSE}
          draftVersionId="course-draft"
          open
          onOpenChange={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPreflight(preflight());
  vi.mocked(publishContainerAction).mockResolvedValue({ ok: true, value: undefined } as never);
});

describe('collectPublishRows', () => {
  it('lists stale modules before the course, so modules go live first', () => {
    const rows = collectPublishRows(
      makeTree('pending_changes', [
        makeModule('mod-1', 'Leksjon 1', 'published'),
        makeModule('mod-2', 'Leksjon 2', 'pending_changes'),
        makeModule('mod-3', 'Leksjon 3', 'draft'),
      ]),
      'Norwegian A2',
    );

    expect(rows.map((r) => r.containerId)).toEqual(['mod-2', 'mod-3', 'course-1']);
    expect(rows.at(-1)?.kind).toBe('course');
  });

  it('leaves out a course that is already up to date', () => {
    const rows = collectPublishRows(
      makeTree('published', [makeModule('mod-1', 'Leksjon 1', 'pending_changes')]),
      'Norwegian A2',
    );

    expect(rows.map((r) => r.containerId)).toEqual(['mod-1']);
  });

  it('returns nothing before the tree resolves', () => {
    expect(collectPublishRows(undefined, 'Norwegian A2')).toEqual([]);
  });
});

describe('ReviewPublishDialog', () => {
  it('says there is nothing to release when everything is published', () => {
    renderDialog(makeTree('published', [makeModule('mod-1', 'Leksjon 1', 'published')]));

    expect(screen.getByText('Everything is published. Nothing to release.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Publish/ })).not.toBeInTheDocument();
  });

  it('publishes every selected container, modules before the course', async () => {
    renderDialog(
      makeTree('pending_changes', [makeModule('mod-2', 'Leksjon 2', 'pending_changes')]),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish 2 items' }));
    });

    await waitFor(() => expect(publishContainerAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(publishContainerAction).mock.calls.map((c) => c[0])).toEqual([
      'mod-2',
      'course-1',
    ]);
  });

  it('leaves a deselected row alone', async () => {
    renderDialog(
      makeTree('pending_changes', [makeModule('mod-2', 'Leksjon 2', 'pending_changes')]),
    );

    fireEvent.click(screen.getByLabelText(/Leksjon 2/));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish 1 item' }));
    });

    await waitFor(() => expect(publishContainerAction).toHaveBeenCalledOnce());
    expect(publishContainerAction).toHaveBeenCalledWith('course-1');
  });

  it('refuses to publish a row whose pre-flight has blockers', () => {
    mockPreflight(preflight(2));
    renderDialog(makeTree('pending_changes', []));

    expect(screen.getByText('2 blockers must be fixed first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Publish/ })).toBeDisabled();
  });

  it('reports the rows that failed instead of claiming success', async () => {
    vi.mocked(publishContainerAction).mockResolvedValue({
      ok: false,
      error: { code: 'forbidden' },
    } as never);
    renderDialog(makeTree('pending_changes', []));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish 1 item' }));
    });

    await waitFor(() => expect(screen.getByText(enMessages.Errors.forbidden)).toBeInTheDocument());
  });
});
