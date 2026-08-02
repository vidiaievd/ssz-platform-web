import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { CurriculumTree as CurriculumTreeData } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { CurriculumTree } from './curriculum-tree';

const TREE: CurriculumTreeData = {
  versionId: 'version-1',
  containerId: 'course-1',
  publishState: 'draft',
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
                {
                  id: 'item-2',
                  itemType: 'vocabulary_list',
                  refId: 'vocab-1',
                  title: 'Arbeidsliv — ord',
                  position: 1,
                  isRequired: true,
                  lessonKind: null,
                  state: 'draft',
                  durationMinutes: null,
                  xpReward: null,
                },
              ],
            },
            {
              id: 'section-2',
              title: 'Practice',
              position: 1,
              items: [],
            },
          ],
          publishState: 'draft',
          ungroupedItems: [],
        },
        {
          id: 'item-module-2',
          containerId: 'module-2',
          versionId: 'module-version-2',
          title: 'På kafé',
          titleEn: 'At the café',
          position: 1,
          isRequired: true,
          sections: [],
          publishState: 'draft',
          ungroupedItems: [
            {
              id: 'item-3',
              itemType: 'grammar_rule',
              refId: 'grammar-1',
              title: 'Bestemt/ubestemt form',
              position: 0,
              isRequired: true,
              lessonKind: null,
              state: 'published',
              durationMinutes: 4,
              xpReward: 5,
            },
          ],
        },
      ],
    },
  ],
};

function InteractiveTree() {
  const [selection, setSelection] = useState<CurriculumTreeSelection | null>(null);
  const selectedId =
    selection?.kind === 'level'
      ? selection.level.id
      : selection?.kind === 'module'
        ? selection.module.id
        : selection?.kind === 'item'
          ? selection.item.id
          : null;
  return (
    <CurriculumTree
      tree={TREE}
      selectedId={selectedId}
      onSelect={setSelection}
      onChanged={() => {}}
      courseContainerId="course-1"
      targetLanguage="no"
      difficultyLevel="A2"
      visibility="public"
      accessTier="free_within_school"
    />
  );
}

const meta = {
  title: 'ContentAuthoring/CurriculumTree',
  component: CurriculumTree,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CurriculumTree>;

export default meta;
type Story = StoryObj<typeof meta>;

const commonArgs = {
  courseContainerId: 'course-1',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  visibility: 'public',
  accessTier: 'free_within_school',
} as const;

export const Default: Story = {
  args: { tree: TREE, selectedId: null, onSelect: () => {}, onChanged: () => {}, ...commonArgs },
};

export const LessonSelected: Story = {
  args: {
    tree: TREE,
    selectedId: 'item-1',
    onSelect: () => {},
    onChanged: () => {},
    ...commonArgs,
  },
};

export const Interactive: Story = {
  args: { tree: TREE, selectedId: null, onSelect: () => {}, onChanged: () => {}, ...commonArgs },
  render: () => <InteractiveTree />,
};
