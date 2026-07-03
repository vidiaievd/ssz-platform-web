import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MasteryBar } from './mastery-bar';

const meta = {
  title: 'Learning/MasteryBar',
  component: MasteryBar,
  decorators: [(Story) => <div className="w-72 p-4"><Story /></div>],
} satisfies Meta<typeof MasteryBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const High: Story = {
  args: { value: 85, skill: 'Listening', showLabel: true },
};

export const Medium: Story = {
  args: { value: 62, skill: 'Reading', showLabel: true },
};

export const Low: Story = {
  args: { value: 30, skill: 'Writing', showLabel: true },
};

export const NoLabel: Story = {
  args: { value: 70, showLabel: false },
};

export const AllTiers: Story = {
  args: { value: 0 },
  render: () => (
    <div className="flex flex-col gap-4">
      <MasteryBar value={85} skill="Listening" />
      <MasteryBar value={60} skill="Reading" />
      <MasteryBar value={25} skill="Writing" />
      <MasteryBar value={0}  skill="Speaking" />
      <MasteryBar value={100} skill="Vocabulary" />
    </div>
  ),
};
