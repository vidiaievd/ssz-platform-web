import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type {
  ContainerPublishState,
  CurriculumTree as CurriculumTreeData,
} from '@/features/content/types';

import { CurriculumPublishSummary } from './curriculum-publish-summary';

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

function renderSummary(tree: CurriculumTreeData) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CurriculumPublishSummary tree={tree} />
    </NextIntlClientProvider>,
  );
}

describe('CurriculumPublishSummary', () => {
  it('reports that everything is live when the course and its modules are published', () => {
    renderSummary(makeTree('published', ['published', 'published']));

    expect(screen.getByText('Everything students see is up to date.')).toBeInTheDocument();
  });

  it('counts only the modules whose draft differs from the published version', () => {
    renderSummary(makeTree('published', ['published', 'pending_changes', 'pending_changes']));

    expect(screen.getByText('2 modules have unpublished changes.')).toBeInTheDocument();
    expect(screen.queryByText(/up to date/)).not.toBeInTheDocument();
  });

  it('uses the singular form for one stale module', () => {
    renderSummary(makeTree('published', ['pending_changes', 'published']));

    expect(screen.getByText('1 module has unpublished changes.')).toBeInTheDocument();
  });

  it('separates never-published modules from stale ones', () => {
    renderSummary(makeTree('published', ['draft', 'draft', 'pending_changes']));

    expect(screen.getByText('1 module has unpublished changes.')).toBeInTheDocument();
    expect(screen.getByText('2 modules are not published yet.')).toBeInTheDocument();
  });

  it('calls out the course itself, separately from its modules', () => {
    renderSummary(makeTree('pending_changes', ['published']));

    expect(screen.getByText('The course itself has unpublished changes.')).toBeInTheDocument();
  });

  it('says students cannot open a course that was never published', () => {
    renderSummary(makeTree('draft', ['published']));

    expect(
      screen.getByText('The course is not published — students cannot open it.'),
    ).toBeInTheDocument();
  });
});
