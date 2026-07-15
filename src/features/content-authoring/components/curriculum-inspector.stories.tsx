import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CurriculumInspector } from './curriculum-inspector';

const meta = {
  title: 'ContentAuthoring/CurriculumInspector',
  component: CurriculumInspector,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CurriculumInspector>;

export default meta;
type Story = StoryObj<typeof meta>;

const commonArgs = { courseContainerId: 'course-1', onChanged: () => {} };

export const EmptySelection: Story = {
  args: { selection: null, ...commonArgs },
};

export const LevelSelected: Story = {
  args: {
    selection: {
      kind: 'level',
      level: { id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [] },
    },
    ...commonArgs,
  },
};

export const ModuleSelected: Story = {
  args: {
    selection: {
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
    },
    ...commonArgs,
  },
};

export const LessonSelected: Story = {
  args: {
    selection: {
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
    },
    ...commonArgs,
  },
};

export const DraftVocabularySelected: Story = {
  args: {
    selection: {
      kind: 'item',
      sectionTitle: null,
      item: {
        id: 'item-2',
        itemType: 'vocabulary_list',
        refId: 'vocab-1',
        title: 'Arbeidsliv — ord',
        position: 0,
        isRequired: true,
        lessonKind: null,
        state: 'draft',
        durationMinutes: null,
        xpReward: null,
      },
    },
    ...commonArgs,
  },
};
