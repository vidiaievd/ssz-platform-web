import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SchoolStatusCard } from './school-status-card';
import type { StudentSchool } from '../types';

function fixture(overrides: Partial<StudentSchool>): StudentSchool {
  return {
    membershipId: 'm1',
    schoolId: 's1',
    schoolSlug: 'oslo-language-school',
    schoolName: 'Oslo Language School',
    status: 'pending',
    groupId: null,
    groupName: null,
    groupAssignedSeenAt: null,
    level: null,
    mode: null,
    ageBand: null,
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
  title: 'Student/SchoolStatusCard',
  component: SchoolStatusCard,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof SchoolStatusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  args: { school: fixture({ status: 'pending' }) },
};

export const Onboarding: Story = {
  args: { school: fixture({ status: 'onboarding', pendingStage: 'onboarding' }) },
};

export const PlacementReview: Story = {
  args: { school: fixture({ status: 'placement-review', pendingStage: 'placement-review' }) },
};

export const Active: Story = {
  args: { school: fixture({ status: 'active', groupId: 'g1', groupName: 'A1 Evening' }) },
};

export const Rejected: Story = {
  args: { school: fixture({ status: 'rejected' }) },
};

export const Left: Story = {
  args: { school: fixture({ status: 'left' }) },
};
