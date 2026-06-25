import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GroupHeader } from './group-header';
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
    level: 'A1',
    mode: 'online',
    ageBand: 'adults',
    teachers: [{ userId: 't1', name: 'Kari Nilsen', avatarUrl: null, role: 'primary' }],
    schedule: [],
    nextLesson: null,
    mainCourse: null,
    materials: [],
    classmateCount: 12,
    ...overrides,
  };
}

const meta = {
  title: 'Student/GroupHeader',
  component: GroupHeader,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
} satisfies Meta<typeof GroupHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { school: fixture({}) },
};

export const InPersonWithCoTeacher: Story = {
  args: {
    school: fixture({
      mode: 'in-person',
      teachers: [
        { userId: 't1', name: 'Kari Nilsen', avatarUrl: null, role: 'primary' },
        { userId: 't2', name: 'Per Olsen', avatarUrl: null, role: 'co-primary' },
      ],
    }),
  },
};

export const WithSubstitute: Story = {
  args: {
    school: fixture({
      teachers: [
        { userId: 't1', name: 'Kari Nilsen', avatarUrl: null, role: 'primary' },
        { userId: 't3', name: 'Lars Berg', avatarUrl: null, role: 'substitute' },
      ],
    }),
  },
};
