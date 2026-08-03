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
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

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
    containerType: 'course',
    levelSystem: 'cefr',
    publishState: coursePublishState,
    levels: [{ id: 'level-a1', title: 'A1', position: 0, modules, items: [] }],
    ungroupedItems: [],
  };
}

function preflight(
  blockerCount = 0,
  warningCount = 0,
  checks: PreflightResult['checks'] = [],
): PreflightResult {
  return { blockerCount, warningCount, checks } as unknown as PreflightResult;
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

  it('names the root row after what the container actually is', () => {
    const moduleTree: CurriculumTree = {
      ...makeTree('pending_changes', []),
      containerType: 'module',
    };

    // The same editor opens a course and a module; calling a module "Course"
    // is how the review screen ended up mislabelling it.
    expect(collectPublishRows(moduleTree, '1A — Bartek søker ny jobb')[0]?.kind).toBe('module');
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

  it('names each blocker and links to where it can be fixed', () => {
    mockPreflight(
      preflight(1, 0, [
        {
          id: 'READ_NO_TITLE:lesson-9',
          severity: 'blocker',
          ruleCode: 'READ_NO_TITLE',
          itemTitle: 'Bartek søker ny jobb',
          detail: 'Lesson has no published variant',
          fixDeepLink: '/school/nordick/content/course-1/lessons/item-9',
        },
      ]),
    );
    renderDialog(makeTree('pending_changes', []));

    // A bare count is unactionable, and so is a rule name on its own when the
    // module holds sixteen items — the author must see which one to fix.
    expect(
      screen.getByText('Lesson has no published content: Bartek søker ny jobb'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Open the lesson and save its text/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute(
      'href',
      '/school/nordick/content/course-1/lessons/item-9',
    );
  });

  it('lists the warnings behind a disclosure, grouped by rule', async () => {
    // "28 warnings" is not something an author can act on, and 26 identical
    // lines about missing audio bury the two that are about something else.
    mockPreflight(
      preflight(0, 3, [
        {
          id: 'VOCAB_NO_AUDIO:word-1',
          severity: 'warning',
          ruleCode: 'VOCAB_NO_AUDIO',
          itemTitle: null,
          detail: 'Vocabulary item has no pronunciation audio',
          fixDeepLink: null,
        },
        {
          id: 'VOCAB_NO_AUDIO:word-2',
          severity: 'warning',
          ruleCode: 'VOCAB_NO_AUDIO',
          itemTitle: null,
          detail: 'Vocabulary item has no pronunciation audio',
          fixDeepLink: null,
        },
        {
          id: 'NO_GRAMMAR:course-1',
          severity: 'warning',
          ruleCode: 'NO_GRAMMAR',
          itemTitle: null,
          detail: 'Course has no grammar content',
          fixDeepLink: null,
        },
      ]),
    );
    renderDialog(makeTree('pending_changes', []));

    expect(screen.queryByText(/no pronunciation audio/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3 warnings/ }));

    expect(screen.getByText('Vocabulary item has no pronunciation audio')).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
    expect(screen.getByText('Course has no grammar content')).toBeInTheDocument();
  });

  it('leaves publishing available while only warnings stand', () => {
    mockPreflight(preflight(0, 2));
    renderDialog(makeTree('pending_changes', []));

    expect(screen.getByRole('button', { name: /^Publish/ })).toBeEnabled();
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
