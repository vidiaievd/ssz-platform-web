import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ResumeHero } from './resume-hero';

const meta = {
  title: 'Student/Home/ResumeHero',
  component: ResumeHero,
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResumeHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Norwegian: Story = {
  args: {
    course: {
      langCode: 'nb',
      langName: 'norsk bokmål',
      level: 'B1',
      courseTitle: 'Ny i Norge — B1',
      nextItemTitle: 'Leksjon 4 · På jobbintervju',
      progressPercent: 38,
      href: '#',
    },
  },
};

/** The gradient is derived from the language hue, so each language reads differently. */
export const Ukrainian: Story = {
  args: {
    course: {
      langCode: 'uk',
      langName: 'українська',
      level: 'A2',
      courseTitle: 'Українська для початківців',
      nextItemTitle: 'Урок 7 · У місті',
      progressPercent: 72,
      href: '#',
    },
  },
};

/** A freshly started course: the bar is present but empty, and that is fine. */
export const JustStarted: Story = {
  args: {
    course: {
      langCode: 'es',
      langName: 'español',
      level: 'A1',
      courseTitle: 'Español desde cero',
      nextItemTitle: 'Lección 1 · Saludos',
      progressPercent: 0,
      href: '#',
    },
  },
};

/** Level is optional — some self-study courses carry no CEFR label. */
export const NoLevel: Story = {
  args: {
    course: {
      langCode: 'fr',
      langName: 'français',
      courseTitle: 'Conversation française',
      nextItemTitle: 'Au marché',
      progressPercent: 55,
      href: '#',
    },
  },
};
