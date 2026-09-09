import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { TopicPicker } from './topic-picker';
import type { OutlineUnit } from '../types';

const UNITS: OutlineUnit[] = [
  {
    id: 'u1',
    title: 'Professional writing',
    order: 1,
    items: [
      { id: 'l1', itemType: 'lesson', kind: 'text', title: 'Formal vs informal register' },
      { id: 'l2', itemType: 'lesson', kind: 'text', title: 'Write a proposal' },
    ],
  },
  {
    id: 'u2',
    title: 'Meetings',
    order: 2,
    items: [{ id: 'l3', itemType: 'lesson', kind: 'audio', title: 'Meeting phrases' }],
  },
];

const NONE = { contentUnitId: null, contentLessonId: null };

describe('TopicPicker', () => {
  it('picks an item together with the unit that holds it', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TopicPicker units={UNITS} value={NONE} onChange={onChange} taughtItemIds={new Set()} />,
    );

    await userEvent.click(screen.getByText('Write a proposal'));
    expect(onChange).toHaveBeenCalledWith({ contentUnitId: 'u1', contentLessonId: 'l2' });
  });

  it('lets a session be pinned to a whole unit, which is what a checkpoint is', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TopicPicker units={UNITS} value={NONE} onChange={onChange} taughtItemIds={new Set()} />,
    );

    await userEvent.click(screen.getByText('Unit 2 · Meetings'));
    expect(onChange).toHaveBeenCalledWith({ contentUnitId: 'u2', contentLessonId: null });
  });

  it('narrows the material to what the search matches', async () => {
    renderWithProviders(
      <TopicPicker units={UNITS} value={NONE} onChange={() => {}} taughtItemIds={new Set()} />,
    );

    await userEvent.type(screen.getByLabelText('Search the course material…'), 'proposal');
    expect(screen.getByText('Write a proposal')).toBeInTheDocument();
    expect(screen.queryByText('Meeting phrases')).not.toBeInTheDocument();
  });

  it('says so rather than showing an empty box when nothing matches', async () => {
    renderWithProviders(
      <TopicPicker units={UNITS} value={NONE} onChange={() => {}} taughtItemIds={new Set()} />,
    );

    await userEvent.type(screen.getByLabelText('Search the course material…'), 'zzz');
    expect(screen.getByText(/Nothing in the course material matches/)).toBeInTheDocument();
  });

  it('flags a topic another session already covers', () => {
    renderWithProviders(
      <TopicPicker units={UNITS} value={NONE} onChange={() => {}} taughtItemIds={new Set(['l1'])} />,
    );
    expect(screen.getByText('already taught')).toBeInTheDocument();
  });

  it('clears back to the legal "no topic" state', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TopicPicker
        units={UNITS}
        value={{ contentUnitId: 'u1', contentLessonId: 'l2' }}
        onChange={onChange}
        taughtItemIds={new Set()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(NONE);
  });
});
