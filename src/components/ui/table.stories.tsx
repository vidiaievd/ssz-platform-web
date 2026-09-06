import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';

const meta = {
  title: 'UI/Table',
  component: Table,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table className="min-w-[500px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Group</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>French A2 · At the café</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>German A1 · Intro group</TableCell>
          <TableCell>Draft</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
