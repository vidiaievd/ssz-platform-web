import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { GroupAssignedBanner } from './group-assigned-banner';
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
    mode: 'online',
    ageBand: 'adults',
    teachers: [],
    schedule: [],
    nextLesson: null,
    mainCourse: null,
    materials: [],
    classmateCount: null,
    ...overrides,
  };
}

const meta = {
  title: 'Student/GroupAssignedBanner',
  component: GroupAssignedBanner,
  decorators: [
    (Story) => {
      const client = new QueryClient();
      return (
        <QueryClientProvider client={client}>
          <div className="max-w-lg"><Story /></div>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof GroupAssignedBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unseen: Story = {
  args: { school: fixture({}) },
};

export const AlreadySeen: Story = {
  args: { school: fixture({ groupAssignedSeenAt: '2026-06-01T00:00:00Z' }) },
};
