import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { GroupEditDialog } from './group-edit-dialog';
import type { Group } from '../types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('../api/mutations', () => ({
  updateGroup: vi.fn(),
}));

const group: Group = {
  id: 'g1',
  name: 'Norwegian A2',
  courseId: null,
  courseName: null,
  lang: 'nb',
  level: 'A2',
  status: 'active',
  mode: 'online',
  capacity: { min: 6, max: 12 },
  studentCount: 10,
  startDate: '2026-01-01',
  endDate: '2026-06-01',
  teachers: [],
  slots: [],
};

function renderDialog(onOpenChange = vi.fn()) {
  return renderWithProviders(
    <GroupEditDialog group={group} schoolId="my-school" open onOpenChange={onOpenChange} />,
  );
}

describe('GroupEditDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables Save when max capacity drops below the enrolled count', async () => {
    renderDialog();

    const maxInput = screen.getByLabelText('Max students');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '5');

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('keeps Save enabled when max capacity stays at or above the enrolled count', async () => {
    renderDialog();

    const maxInput = screen.getByLabelText('Max students');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '15');

    expect(screen.getByRole('button', { name: 'Save changes' })).not.toBeDisabled();
  });

  it('shows a validation error when the end date is before the start date', async () => {
    renderDialog();

    const endDateInput = screen.getByLabelText('End date');
    fireEvent.change(endDateInput, { target: { value: '2025-01-01' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('End date must be on or after start date')).toBeInTheDocument();
    const { updateGroup } = await import('../api/mutations');
    expect(updateGroup).not.toHaveBeenCalled();
  });

  it('prompts to discard unsaved changes when closing a dirty form', async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    const nameInput = screen.getByLabelText('Name');
    await userEvent.type(nameInput, ' updated');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes immediately when canceling a clean (non-dirty) form', () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });
});
