import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { HelperIllustrationPanel } from './helper-panel';

const meta = {
  title: 'School/HelperTrustPanel',
  component: HelperIllustrationPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HelperIllustrationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: 'desktop' } },
  decorators: [
    (Story) => (
      <div className="grid md:grid-cols-[1.2fr_1fr] min-h-screen">
        <div className="bg-surface p-8 flex items-center justify-center text-(--ssz-text-muted)">
          ← Form column
        </div>
        <Story />
      </div>
    ),
  ],
};

export const MobileAccordion: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story) => (
      <div className="border border-(--ssz-border-default)">
        <Story />
      </div>
    ),
  ],
};
