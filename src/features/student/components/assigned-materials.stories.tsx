import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AssignedMaterials } from './assigned-materials';
import type { AssignedMaterial } from '../types';

function assignment(overrides: Partial<AssignedMaterial>): AssignedMaterial {
  return {
    assignmentId: 'assignment-1',
    contentType: 'LESSON',
    contentId: 'lesson-1',
    title: 'Chapter 3 — Past Tense',
    status: 'active',
    dueAt: '2026-07-01T00:00:00Z',
    notes: null,
    href: '/student/enrolled/lessons/lesson-1',
    ...overrides,
  };
}

const meta = {
  title: 'Student/AssignedMaterials',
  component: AssignedMaterials,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof AssignedMaterials>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { assignments: [] },
};

export const Mixed: Story = {
  args: {
    assignments: [
      assignment({ assignmentId: 'a1' }),
      assignment({
        assignmentId: 'a2',
        title: 'Vocabulary Quiz — Food',
        status: 'overdue',
        contentType: 'EXERCISE',
        href: null,
      }),
    ],
  },
};
