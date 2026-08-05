import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Layers, PenLine, Repeat } from 'lucide-react';

import { TrainingTile, type TrainingTileData } from './training-tile';

const meta = {
  title: 'Student/Home/TrainingTile',
  component: TrainingTile,
  decorators: [
    (Story) => (
      <div className="max-w-56">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrainingTile>;

export default meta;
type Story = StoryObj<typeof meta>;

const grammar: TrainingTileData = {
  id: 'grammar',
  icon: PenLine,
  hue: 168,
  label: 'Grammar',
  description: 'Rules, drills & error-spotting',
  ready: 34,
};

export const Compact: Story = {
  args: { tile: grammar },
};

export const Featured: Story = {
  args: {
    size: 'lg',
    tile: {
      id: 'complex',
      icon: Layers,
      hue: 168,
      label: 'Complex session',
      description: 'A mixed set across every skill, weighted to what you need most right now.',
      meta: '~15 min · adaptive',
    },
  },
};

export const Disabled: Story = {
  args: {
    tile: {
      id: 'review',
      icon: Repeat,
      hue: 82,
      label: 'Review what’s due',
      description: 'Spaced repetition — nothing is due right now.',
      ready: 0,
      disabled: true,
    },
  },
};
