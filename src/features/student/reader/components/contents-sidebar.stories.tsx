import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ContentsSidebar } from './contents-sidebar';
import type { ReaderSidebarCourse, ReaderSidebarUnit } from '../types';

const course: ReaderSidebarCourse = {
  title: 'Norsk B1',
  flag: '🇳🇴',
  subtitle: 'Nordlys Språkskole · Gruppe 2B',
  percentComplete: 34,
  itemsDone: 17,
  itemsTotal: 50,
};

const units: ReaderSidebarUnit[] = [
  { id: 'u1', position: 1, title: 'Hverdagsliv', subtitle: 'Everyday life', status: 'done', sections: [] },
  { id: 'u2', position: 2, title: 'Mat og helse', subtitle: 'Food & health', status: 'done', sections: [] },
  {
    id: 'u3',
    position: 3,
    title: 'Arbeid og studier',
    subtitle: 'Work & study',
    status: 'active',
    sections: [
      {
        id: 's-vocab',
        label: 'New words',
        items: [
          {
            id: 'vocab-yrker',
            kind: 'vocab',
            title: 'Yrker og oppgaver',
            durationLabel: '7 min',
            status: 'in_progress',
            href: '/student/courses/course-1/u3/vocab-yrker',
          },
        ],
      },
      {
        id: 's-read',
        label: 'Reinforce & read',
        items: [
          {
            id: 'text-arbeidsdag',
            kind: 'text',
            title: 'En vanlig arbeidsdag',
            durationLabel: '8 min',
            status: 'available',
            href: '/student/courses/course-1/u3/text-arbeidsdag',
          },
          {
            id: 'video-intervju',
            kind: 'video',
            title: 'Intervju på jobben',
            durationLabel: '6 min',
            status: 'completed',
            href: '/student/courses/course-1/u3/video-intervju',
          },
        ],
      },
      {
        id: 's-practice',
        label: 'Practice',
        items: [
          {
            id: 'ex-blandet',
            kind: 'exercise',
            title: 'Blandet øving',
            durationLabel: '12 min',
            status: 'locked',
            href: '/student/courses/course-1/u3/ex-blandet',
          },
        ],
      },
    ],
  },
  { id: 'u4', position: 4, title: 'Meninger og fortellinger', subtitle: 'Opinions & narratives', status: 'locked', sections: [] },
];

const meta = {
  title: 'Student/Reader/ContentsSidebar',
  component: ContentsSidebar,
  decorators: [(Story) => <div style={{ height: '100vh', display: 'flex' }}><Story /></div>],
} satisfies Meta<typeof ContentsSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: {
    course,
    units,
    activeItemId: 'vocab-yrker',
    collapsed: false,
    onToggleCollapse: () => {},
  },
};

export const Collapsed: Story = {
  args: {
    course,
    units,
    activeItemId: 'vocab-yrker',
    collapsed: true,
    onToggleCollapse: () => {},
  },
};

export const Interactive: Story = {
  render: (args) => {
    function Wrapper() {
      const [collapsed, setCollapsed] = useState(false);
      return <ContentsSidebar {...args} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />;
    }
    return <Wrapper />;
  },
  args: {
    course,
    units,
    activeItemId: 'vocab-yrker',
    collapsed: false,
    onToggleCollapse: () => {},
  },
};
