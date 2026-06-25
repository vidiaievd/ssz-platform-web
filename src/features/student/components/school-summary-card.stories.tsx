import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SchoolSummaryCard } from './school-summary-card';
import type { StudentSchool } from '../types';

function fixture(overrides: Partial<StudentSchool>): StudentSchool {
  return {
    membershipId: 'm1',
    schoolId: 's1',
    schoolSlug: 'oslo-language-school',
    schoolName: 'Oslo Language School',
    status: 'active',
    groupId: 'g1',
    groupName: 'A1 Evening',
    groupAssignedSeenAt: null,
    level: 'A1',
    mode: 'in-person',
    ageBand: 'adults',
    teachers: [{ userId: 't1', name: 'Anna Olsen', avatarUrl: null, role: 'primary' }],
    schedule: [{ day: 'Mon', start: '18:00', end: '19:30', room: 'Room 2' }],
    nextLesson: { day: 'Mon', start: '18:00', end: '19:30', date: '2026-06-29' },
    mainCourse: { id: 'c1', courseId: 'c1', courseName: 'Norsk A1 — Grunnkurs', isMain: true },
    materials: [],
    classmateCount: 11,
    ...overrides,
  };
}

const meta = {
  title: 'Student/SchoolSummaryCard',
  component: SchoolSummaryCard,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
} satisfies Meta<typeof SchoolSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUpcomingLesson: Story = {
  args: { school: fixture({}) },
};

export const NoUpcomingLesson: Story = {
  args: { school: fixture({ nextLesson: null, schedule: [] }) },
};

export const MultipleTeachers: Story = {
  args: {
    school: fixture({
      teachers: [
        { userId: 't1', name: 'Anna Olsen', avatarUrl: null, role: 'primary' },
        { userId: 't2', name: 'Erik Berg', avatarUrl: null, role: 'co-primary' },
      ],
    }),
  },
};
