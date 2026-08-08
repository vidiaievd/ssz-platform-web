import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  ContainerPublishState,
  CurriculumTree as CurriculumTreeData,
} from '@/features/content/types';

import { UnpublishedBanner } from './unpublished-banner';

function makeTree(
  coursePublishState: ContainerPublishState,
  modulePublishStates: ContainerPublishState[],
): CurriculumTreeData {
  return {
    versionId: 'version-1',
    containerId: 'course-1',
    levelSystem: 'cefr',
    publishState: coursePublishState,
    containerType: 'course' as const,
    ungroupedItems: [],
    levels: [
      {
        id: 'level-a1',
        title: 'A1 — Beginner',
        position: 0,
        items: [],
        modules: modulePublishStates.map((publishState, i) => ({
          id: `item-module-${i}`,
          containerId: `module-${i}`,
          versionId: `module-version-${i}`,
          title: `Module ${i}`,
          titleEn: null,
          position: i,
          isRequired: true,
          publishState,
          sections: [],
          ungroupedItems: [],
        })),
      },
    ],
  };
}

function renderBanner(tree: CurriculumTreeData, onReview = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UnpublishedBanner tree={tree} onReview={onReview} />
    </NextIntlClientProvider>,
  );
  return { onReview };
}

describe('UnpublishedBanner', () => {
  it('reports that everything is live when the course and its modules are published', () => {
    renderBanner(makeTree('published', ['published', 'published']));

    expect(screen.getByText('Everything students see is up to date.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
  });

  // The headline must match the metric strip and the publish dialog exactly, so
  // it counts the same rows they do (BEHAVIOR.md §5.2).
  it('counts every row the publish dialog would list', () => {
    renderBanner(makeTree('pending_changes', ['published', 'pending_changes', 'draft']));

    expect(screen.getByText('3 items have unpublished changes.')).toBeInTheDocument();
    expect(
      screen.getByText('Students still see the last published version.'),
    ).toBeInTheDocument();
  });

  it('uses the singular form for a single pending row', () => {
    renderBanner(makeTree('published', ['pending_changes', 'published']));

    expect(screen.getByText('1 item has unpublished changes.')).toBeInTheDocument();
  });

  it('separates never-published modules from stale ones', () => {
    renderBanner(makeTree('published', ['draft', 'draft', 'pending_changes']));

    expect(screen.getByText('1 module has unpublished changes.')).toBeInTheDocument();
    expect(screen.getByText('2 modules are not published yet.')).toBeInTheDocument();
  });

  it('calls out the course itself, separately from its modules', () => {
    renderBanner(makeTree('pending_changes', ['published']));

    expect(screen.getByText('The course itself has unpublished changes.')).toBeInTheDocument();
  });

  it('says students cannot open a course that was never published', () => {
    renderBanner(makeTree('draft', ['published']));

    expect(
      screen.getByText('The course is not published — students cannot open it.'),
    ).toBeInTheDocument();
  });

  it('opens the publish review from the banner', () => {
    const { onReview } = renderBanner(makeTree('published', ['draft']));

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(onReview).toHaveBeenCalled();
  });
});
