import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GroupMaterials, type CourseMaterialLink } from './group-materials';

function material(overrides: Partial<CourseMaterialLink>): CourseMaterialLink {
  return {
    id: 'mat-1',
    courseId: 'course-1',
    courseName: 'Norwegian A1 — Coursebook',
    isMain: false,
    isAvailable: true,
    ...overrides,
  };
}

const meta = {
  title: 'Student/GroupMaterials',
  component: GroupMaterials,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof GroupMaterials>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { mainCourse: null, materials: [] },
};

export const MainCourseOnly: Story = {
  args: {
    mainCourse: material({ id: 'main', isMain: true }),
    materials: [],
  },
};

export const MainPlusExtras: Story = {
  args: {
    mainCourse: material({ id: 'main', isMain: true }),
    materials: [
      material({ id: 'extra-1', courseId: 'course-2', courseName: 'Grammar Workbook' }),
      material({ id: 'extra-2', courseId: 'course-3', courseName: 'Listening Practice' }),
    ],
  },
};

export const UnpublishedMaterial: Story = {
  args: {
    mainCourse: material({ id: 'main', isMain: true }),
    materials: [
      material({ id: 'extra-1', courseId: 'course-2', courseName: 'Coming Soon', isAvailable: false }),
    ],
  },
};

export const WithProgress: Story = {
  args: {
    mainCourse: material({ id: 'main', isMain: true, progressStatus: 'in_progress' }),
    materials: [
      material({ id: 'extra-1', courseId: 'course-2', courseName: 'Grammar Workbook', progressStatus: 'completed' }),
      material({ id: 'extra-2', courseId: 'course-3', courseName: 'Listening Practice', progressStatus: 'needs_review' }),
    ],
  },
};
