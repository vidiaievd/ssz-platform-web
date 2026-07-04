import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { UnitStepper } from './unit-stepper';

const meta = {
  title: 'Learning/UnitStepper',
  component: UnitStepper,
  decorators: [(Story) => <div className="w-full max-w-lg border-b bg-[var(--ssz-bg-surface)] p-4"><Story /></div>],
} satisfies Meta<typeof UnitStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadPhase: Story = {
  args: { phase: 'read' },
};

export const VocabPass: Story = {
  args: { phase: 'vocab-pass' },
};

export const GrammarRead: Story = {
  args: { phase: 'grammar-read' },
};

export const Practice: Story = {
  args: { phase: 'practice' },
};

export const Complete: Story = {
  args: { phase: 'complete' },
};
