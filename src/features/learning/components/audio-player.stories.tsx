import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AudioPlayer } from './audio-player';

const meta = {
  title: 'Learning/AudioPlayer',
  component: AudioPlayer,
  decorators: [(Story) => <div className="max-w-sm p-4"><Story /></div>],
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shell: Story = {
  args: { interactive: false, label: 'Listen to text' },
};

export const CompactShell: Story = {
  args: { interactive: false, label: 'Listen', compact: true },
};

export const WithAudio: Story = {
  args: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/De-Konjunktion.ogg',
    label: 'Listen to word',
  },
};

export const CompactWithAudio: Story = {
  args: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/De-Konjunktion.ogg',
    label: 'Lytt',
    compact: true,
  },
};

export const NoSource: Story = {
  args: { label: 'No audio source' },
};
