import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('@/features/groups/api/mutations', () => ({ assignTeacher: vi.fn() }));

import { assignTeacher } from '@/features/groups/api/mutations';
import { AssignReviewerDialog, staffOfGroups, type AssignTarget } from './assign-reviewer-dialog';

const SCHOOL_ID = 'school-1';

const GROUPS = [
  { id: 'group-1', name: 'B1 kveld' },
  { id: 'group-2', name: 'A2 dag' },
];

const submission = (over: Partial<Extract<AssignTarget, { kind: 'submission' }>> = {}) =>
  ({
    kind: 'submission',
    groupId: 'group-2',
    studentName: 'Anna Kowalska',
    exerciseTitle: 'Perfektum',
    unassigned: false,
    ...over,
  }) satisfies AssignTarget;

function renderDialog(target: AssignTarget) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AssignReviewerDialog
          schoolId={SCHOOL_ID}
          target={target}
          groups={GROUPS}
          onClose={onClose}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

const TEACHERS = [
  { teacherId: 'teacher-1', name: 'Marius Holt' },
  { teacherId: 'teacher-2', name: 'Per Nygård' },
];

/** organization's group summaries — only the staff matters to the dialog. */
let groupStaff: { id: string; teachers: { userId: string; role: string; toDate: string | null }[] }[];

beforeEach(() => {
  vi.clearAllMocks();
  groupStaff = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/groups') ? groupStaff : TEACHERS),
    })),
  );
  vi.mocked(assignTeacher).mockResolvedValue({ ok: true });
});

const optionNames = () =>
  Array.from((screen.getByLabelText('Teacher') as HTMLSelectElement).options).map((o) => o.text);

describe('AssignReviewerDialog', () => {
  it('says that this writes a place in the group, not a role of its own', async () => {
    renderDialog(submission());

    expect(
      await screen.findByText("This adds the person to the group's staff"),
    ).toBeInTheDocument();
    expect(screen.getByText(/sees this group's whole queue in their inbox/)).toBeInTheDocument();
  });

  it('opens on the submission group and adds the chosen teacher to it', async () => {
    const { onClose } = renderDialog(submission());

    const teacher = await screen.findByLabelText('Teacher');
    expect(screen.getByLabelText('Group')).toHaveValue('group-2');

    await userEvent.selectOptions(teacher, 'teacher-1');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(assignTeacher).toHaveBeenCalledWith(
        SCHOOL_ID,
        'group-2',
        expect.objectContaining({ userId: 'teacher-1', role: 'co-primary' }),
        true,
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('carries the dates of a substitution, so the queue returns on its own', async () => {
    renderDialog(submission());

    await userEvent.selectOptions(await screen.findByLabelText('Teacher'), 'teacher-2');
    await userEvent.click(screen.getByRole('radio', { name: 'Substitute' }));
    await userEvent.type(screen.getByLabelText('From'), '2026-08-15');
    await userEvent.type(screen.getByLabelText('Until'), '2026-08-29');
    await userEvent.type(screen.getByLabelText('Reason'), 'Sick leave');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(assignTeacher).toHaveBeenCalledWith(
        SCHOOL_ID,
        'group-2',
        expect.objectContaining({
          userId: 'teacher-2',
          role: 'substitute',
          from: '2026-08-15',
          to: '2026-08-29',
          reason: 'Sick leave',
        }),
        true,
      );
    });
  });

  it("puts a helper into the colleague's own groups, and never the colleague", async () => {
    renderDialog({
      kind: 'teacher',
      teacherId: 'teacher-2',
      teacherName: 'Per Nygård',
      groups: [{ id: 'group-3', name: 'C1 morgen' }],
    });

    expect(screen.getByText('A helper for Per Nygård')).toBeInTheDocument();
    const teacher = await screen.findByLabelText('Teacher');
    expect(screen.getByLabelText('Group')).toHaveValue('group-3');
    expect(screen.queryByRole('option', { name: 'B1 kveld' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Per Nygård' })).not.toBeInTheDocument();

    await userEvent.selectOptions(teacher, 'teacher-1');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(assignTeacher).toHaveBeenCalledWith(
        SCHOOL_ID,
        'group-3',
        expect.objectContaining({ userId: 'teacher-1', role: 'co-primary' }),
        true,
      );
    });
  });

  it('leaves out who already teaches the chosen group, in any role (OQ-17)', async () => {
    groupStaff = [
      { id: 'group-2', teachers: [{ userId: 'teacher-1', role: 'substitute', toDate: null }] },
      { id: 'group-1', teachers: [{ userId: 'teacher-2', role: 'primary', toDate: null }] },
    ];
    renderDialog(submission());

    await screen.findByLabelText('Teacher');
    expect(optionNames()).toEqual(['Choose a teacher…', 'Per Nygård']);

    await userEvent.selectOptions(screen.getByLabelText('Group'), 'group-1');
    expect(optionNames()).toEqual(['Choose a teacher…', 'Marius Holt']);
  });

  it('drops a choice that the newly chosen group already has', async () => {
    groupStaff = [{ id: 'group-1', teachers: [{ userId: 'teacher-2', role: 'primary', toDate: null }] }];
    renderDialog(submission());

    await userEvent.selectOptions(await screen.findByLabelText('Teacher'), 'teacher-2');
    await userEvent.selectOptions(screen.getByLabelText('Group'), 'group-1');

    expect(screen.getByLabelText('Teacher')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('offers again someone whose substitution in the group is over', async () => {
    groupStaff = [{ id: 'group-2', teachers: [{ userId: 'teacher-1', role: 'substitute', toDate: '2020-01-31T00:00:00.000Z' }] }];
    renderDialog(submission());

    await screen.findByLabelText('Teacher');
    expect(optionNames()).toContain('Marius Holt');
  });

  it('names the refusal when the server finds the teacher already in the group', async () => {
    vi.mocked(assignTeacher).mockResolvedValue({ ok: false, blocked: 'already-in-group' });
    const { onClose } = renderDialog(submission());

    await userEvent.selectOptions(await screen.findByLabelText('Teacher'), 'teacher-1');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText('This teacher already works in this group in another role.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refuses to pretend it can help a learner who is in no group', async () => {
    renderDialog(submission({ unassigned: true, groupId: null }));

    expect(await screen.findByText('This learner is in no group')).toBeInTheDocument();
    // No form at all: an assignment here would be saved and change nothing.
    expect(screen.queryByLabelText('Teacher')).not.toBeInTheDocument();
  });
});

describe('staffOfGroups', () => {
  const now = new Date('2026-11-23T10:00:00Z');

  it('keeps open, running and future assignments and drops ended ones', () => {
    expect(
      staffOfGroups(
        [
          {
            id: 'g',
            teachers: [
              { userId: 'open', toDate: null },
              { userId: 'ends-today', toDate: '2026-11-23T00:00:00.000Z' },
              { userId: 'ended', toDate: '2026-11-22T00:00:00.000Z' },
            ],
          },
          { id: 'empty' },
        ],
        now,
      ),
    ).toEqual({ g: ['open', 'ends-today'], empty: [] });
  });
});
