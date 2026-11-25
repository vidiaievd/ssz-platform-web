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
  updateSlots: vi.fn(),
  addGroupMaterial: vi.fn(),
  removeGroupMaterial: vi.fn(),
}));

vi.mock('../api/use-assignable-courses', () => ({
  useAssignableCourses: () => ({
    data: {
      items: [
        { id: '11111111-1111-4111-8111-111111111111', title: 'Norwegian A2 — Grammar' },
        { id: '22222222-2222-4222-8222-222222222222', title: 'Norwegian A2 — Vocabulary' },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('../api/use-school-age-bands', () => ({
  useSchoolAgeBands: () => ({ data: [] }),
}));

const baseGroup: Group = {
  id: 'g1',
  name: 'Norwegian A2',
  courseId: null,
  courseName: null,
  materials: [],
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
  ageBand: null,
};

function renderDialog(onOpenChange = vi.fn(), group: Group = baseGroup) {
  return renderWithProviders(
    <GroupEditDialog group={group} schoolId="my-school" workspaceId="my-school" open onOpenChange={onOpenChange} />,
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

  it('offers no way to clear the main material once set — only "Change"', () => {
    renderDialog(vi.fn(), {
      ...baseGroup,
      courseId: '11111111-1111-4111-8111-111111111111',
      courseName: 'Norwegian A2 — Grammar',
    });

    expect(screen.getByText('Norwegian A2 — Grammar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove course' })).not.toBeInTheDocument();
  });

  it('lets an admin attach an additional material', async () => {
    const { addGroupMaterial } = await import('../api/mutations');
    vi.mocked(addGroupMaterial).mockResolvedValue({ ok: true, id: 'mat-x' });

    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Add material' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Norwegian A2 — Grammar' }));

    await waitFor(() =>
      expect(addGroupMaterial).toHaveBeenCalledWith(
        'my-school',
        'g1',
        '11111111-1111-4111-8111-111111111111',
      ),
    );
  });

  it('lets an admin remove an attached additional material', async () => {
    const { removeGroupMaterial } = await import('../api/mutations');
    vi.mocked(removeGroupMaterial).mockResolvedValue({ ok: true });

    renderDialog(vi.fn(), {
      ...baseGroup,
      materials: [{ id: 'mat-1', courseId: '22222222-2222-4222-8222-222222222222', courseName: 'Norwegian A2 — Vocabulary' }],
    });

    expect(screen.getByText('Norwegian A2 — Vocabulary')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove material' }));

    await waitFor(() =>
      expect(removeGroupMaterial).toHaveBeenCalledWith('my-school', 'g1', 'mat-1'),
    );
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

  describe('slots', () => {
    // NO-A2-2026 had "00:00–13:45" twice a week: the dialog let it through and so did the server.
    const groupWithSlot: Group = {
      ...baseGroup,
      slots: [{ id: 's1', day: 'Mon', start: '18:00', end: '19:30', room: '' }],
    };

    it('holds the save back when a changed slot is longer than four hours', async () => {
      const { updateGroup, updateSlots } = await import('../api/mutations');
      renderDialog(vi.fn(), groupWithSlot);

      fireEvent.change(screen.getByLabelText('Start'), { target: { value: '00:00' } });
      fireEvent.change(screen.getByLabelText('End'), { target: { value: '13:45' } });

      expect(screen.getByText('A lesson lasts at most 4 hours.')).toBeInTheDocument();
      const save = screen.getByRole('button', { name: 'Save changes' });
      expect(save).toBeDisabled();
      fireEvent.click(save);
      expect(updateGroup).not.toHaveBeenCalled();
      expect(updateSlots).not.toHaveBeenCalled();
    });

    it('holds the save back when a changed slot ends before it starts', async () => {
      renderDialog(vi.fn(), groupWithSlot);

      fireEvent.change(screen.getByLabelText('End'), { target: { value: '17:00' } });

      expect(screen.getByText('The end must be after the start.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('still lets a group with an old bad slot be renamed — the untouched slots are not sent', async () => {
      const { updateGroup, updateSlots } = await import('../api/mutations');
      vi.mocked(updateGroup).mockResolvedValue({ ok: true });
      renderDialog(vi.fn(), {
        ...baseGroup,
        slots: [{ id: 's1', day: 'Mon', start: '00:00', end: '13:45', room: '' }],
      });

      expect(screen.getByText('A lesson lasts at most 4 hours.')).toBeInTheDocument();
      const name = screen.getByLabelText('Name');
      await userEvent.clear(name);
      await userEvent.type(name, 'Norwegian A2 — renamed');
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(updateGroup).toHaveBeenCalled());
      expect(updateSlots).not.toHaveBeenCalled();
    });
  });
});
