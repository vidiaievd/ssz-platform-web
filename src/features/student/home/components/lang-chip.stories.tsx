import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LangChip } from './lang-chip';

const meta = {
  title: 'Student/Home/LangChip',
  component: LangChip,
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LangChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Norwegian: Story = { args: { langCode: 'nb', level: 'B1' } };
export const Spanish: Story = { args: { langCode: 'es', level: 'A2' } };
export const Larger: Story = { args: { langCode: 'fr', level: 'A1', size: 64 } };
