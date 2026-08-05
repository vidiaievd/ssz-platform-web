import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CourseProgressCard, type CourseProgressCardData } from './course-progress-card';

function fixture(overrides: Partial<CourseProgressCardData> = {}): CourseProgressCardData {
  return {
    id: 'no-b1',
    langCode: 'nb',
    langName: 'Norwegian',
    level: 'B1',
    title: 'Norwegian B1 — Intermediate',
    source: 'school',
    school: 'Nordlys Språkskole',
    progressPercent: 31,
    completedItems: 11,
    totalItems: 36,
    nextUnitLabel: 'Unit 4',
    nextItemTitle: 'Expressing opinions politely',
    lastActiveLabel: 'Yesterday',
    ...overrides,
  };
}

const meta = {
  title: 'Student/Home/CourseProgressCard',
  component: CourseProgressCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CourseProgressCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SchoolCourse: Story = {
  args: { course: fixture() },
};

export const SelfStudyByWords: Story = {
  args: {
    course: fixture({
      id: 'es-ess',
      langCode: 'es',
      langName: 'Spanish',
      level: 'A2',
      title: 'Spanish Essentials',
      source: 'self',
      school: undefined,
      progressPercent: 62,
      completedItems: 0,
      totalItems: 0,
      wordsLearned: 340,
      nextUnitLabel: 'Vocabulary',
      nextItemTitle: 'Food & the market',
      lastActiveLabel: 'Today',
    }),
  },
};

export const FreeCourse: Story = {
  args: {
    course: fixture({
      id: 'fr-pron',
      langCode: 'fr',
      langName: 'French',
      level: 'A1',
      title: 'French Pronunciation Lab',
      source: 'free',
      school: undefined,
      progressPercent: 28,
      completedItems: 5,
      totalItems: 18,
      nextUnitLabel: 'Module 6',
      nextItemTitle: 'Nasal vowels',
      lastActiveLabel: '1 week ago',
    }),
  },
};
