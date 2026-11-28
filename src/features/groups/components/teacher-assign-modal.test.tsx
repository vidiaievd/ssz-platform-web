import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useNavHistoryStore } from '@/stores/nav-history-store';
import type { TeacherAssignCandidate } from '../api/queries';
import { TeacherAssignModal } from './teacher-assign-modal';

const back = vi.fn();
const refresh = vi.fn();
const replace = vi.fn();
const searchParamsStore = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back, refresh, replace, push: vi.fn() }),
  usePathname: () => '/w/nordick/groups/g1/assign-teacher',
  useSearchParams: () => searchParamsStore,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../api/mutations', () => ({ assignTeacher: vi.fn() }));
const { assignTeacher } = await import('../api/mutations');

function candidate(over: Partial<TeacherAssignCandidate> = {}): TeacherAssignCandidate {
  return {
    userId: 't1',
    name: 'Marius Holt',
    avatarUrl: null,
    maxWeeklyHours: 20,
    langs: ['nb'],
    currentHours: 2,
    currentGroups: 1,
    currentConflicts: 0,
    langFit: true,
    availabilityStatus: 'available',
    ...over,
  } as TeacherAssignCandidate;
}

function renderModal(candidates: TeacherAssignCandidate[] = [candidate()]) {
  return renderWithProviders(
    <TeacherAssignModal
      groupId="g1"
      groupName="NO-A2-2026"
      groupLang="nb"
      groupSlots={[]}
      candidates={candidates}
      schoolId="school-1"
      workspaceId="nordick"
    />,
  );
}

async function chooseAndAssign(label: RegExp) {
  await userEvent.click(screen.getByRole('option', { name: /Marius Holt/ }));
  await userEvent.click(screen.getByRole('button', { name: label }));
}

describe('TeacherAssignModal — replacing the holder of a role (П7-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsStore.delete('role');
    // Opened from the group page by a client-side navigation.
    useNavHistoryStore.setState({ previousPath: '/w/nordick/groups/g1' });
  });

  it('asks before replacing, then sends override only on "Replace"', async () => {
    vi.mocked(assignTeacher)
      .mockResolvedValueOnce({ ok: false, blocked: 'role-taken' })
      .mockResolvedValueOnce({ ok: true });
    renderModal();

    await chooseAndAssign(/^Assign teacher$/);

    expect(
      await screen.findByText(/already has a primary teacher.*Marius Holt/),
    ).toBeInTheDocument();
    expect(assignTeacher).toHaveBeenLastCalledWith('school-1', 'g1', expect.objectContaining({ role: 'primary' }), false);

    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      expect(assignTeacher).toHaveBeenLastCalledWith(
        'school-1',
        'g1',
        expect.objectContaining({ userId: 't1', role: 'primary' }),
        true,
      );
    });
    expect(back).toHaveBeenCalled();
  });

  it('a client-side warning alone does not replace anyone', async () => {
    vi.mocked(assignTeacher).mockResolvedValue({ ok: false, blocked: 'role-taken' });
    // A timetable clash turns the button into "Assign anyway" — a warning of the client only.
    renderModal([candidate({ availabilityStatus: 'conflict' })]);

    await chooseAndAssign(/^Assign anyway$/);

    await waitFor(() => {
      expect(assignTeacher).toHaveBeenCalledWith('school-1', 'g1', expect.anything(), false);
    });
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
  });

  it('another role drops the confirmation', async () => {
    vi.mocked(assignTeacher).mockResolvedValue({ ok: false, blocked: 'role-taken' });
    renderModal();

    await chooseAndAssign(/^Assign teacher$/);
    await screen.findByRole('button', { name: 'Replace' });

    await userEvent.click(screen.getByRole('radio', { name: /Co-teacher|Co-primary/ }));
    await userEvent.click(screen.getByRole('option', { name: /Marius Holt/ }));

    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
  });
});

describe('TeacherAssignModal — closing (П7-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsStore.delete('role');
  });

  it('opened from inside the app, "Cancel" goes back', async () => {
    useNavHistoryStore.setState({ previousPath: '/w/nordick/groups/g1' });
    renderModal();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(back).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('opened by a direct link, "Cancel" replaces the URL with the group page', async () => {
    useNavHistoryStore.setState({ previousPath: null });
    renderModal();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(replace).toHaveBeenCalledWith('/w/nordick/groups/g1');
    expect(back).not.toHaveBeenCalled();
  });

  it('opened by a direct link, a successful assignment lands on the group page', async () => {
    useNavHistoryStore.setState({ previousPath: null });
    vi.mocked(assignTeacher).mockResolvedValueOnce({ ok: true });
    renderModal();
    await chooseAndAssign(/^Assign teacher$/);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/w/nordick/groups/g1'));
    expect(back).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });
});
