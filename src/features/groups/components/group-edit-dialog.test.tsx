import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
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

vi.mock('@/features/content-authoring/api/use-my-containers', () => ({
  useMyContainers: () => ({
    data: { items: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Norwegian A2 — Grammar' }] },
    isLoading: false,
  }),
}));

const baseGroup: Group = {
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

function renderDialog(onOpenChange = vi.fn(), group: Group = baseGroup) {
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

  it('lets an admin attach a course to a group that has none', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Add course' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Norwegian A2 — Grammar' }));

    expect(screen.getByText('Norwegian A2 — Grammar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add course' })).not.toBeInTheDocument();
  });

  it('lets an admin remove the currently linked course', async () => {
    renderDialog(vi.fn(), {
      ...baseGroup,
      courseId: '11111111-1111-4111-8111-111111111111',
      courseName: 'Norwegian A2 — Grammar',
    });

    expect(screen.getByText('Norwegian A2 — Grammar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove course' }));

    expect(screen.queryByText('Norwegian A2 — Grammar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add course' })).toBeInTheDocument();
  });

  it('includes the selected courseId in the save payload', async () => {
    const { updateGroup } = await import('../api/mutations');
    vi.mocked(updateGroup).mockResolvedValue({ ok: true });

    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Add course' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Norwegian A2 — Grammar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateGroup).toHaveBeenCalledWith(
        'my-school',
        'g1',
        expect.objectContaining({ courseId: '11111111-1111-4111-8111-111111111111' }),
      ),
    );
  });
});
