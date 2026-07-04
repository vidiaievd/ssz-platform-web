'use client';

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { RefStrip } from './ref-strip';

const PARAGRAPHS = [
  {
    native: 'Jeg heter Marta og jobber som sykepleier på et sykehus i Oslo.',
    translation: 'My name is Marta and I work as a nurse at a hospital in Oslo.',
  },
  {
    native: 'På jobben har jeg mange oppgaver. Jeg tar blodprøver, hjelper pasienter og snakker med leger.',
    translation: 'At work I have many tasks. I take blood samples, help patients and talk with doctors.',
  },
];

const BASE_ARGS = {
  title: 'En vanlig arbeidsdag',
  paragraphs: PARAGRAPHS,
  open: false,
  onToggle: () => {},
};

const meta = {
  title: 'Learning/RefStrip',
  component: RefStrip,
  decorators: [(Story) => <div className="max-w-lg p-4"><Story /></div>],
  args: BASE_ARGS,
} satisfies Meta<typeof RefStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { open: false },
};

export const Expanded: Story = {
  args: { open: true },
};

export const Interactive: Story = {
  args: BASE_ARGS,
  render: (args) => {
    const [open, setOpen] = useState(false);
    return <RefStrip {...args} open={open} onToggle={() => setOpen(v => !v)} />;
  },
};
