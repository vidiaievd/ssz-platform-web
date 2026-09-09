import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('@/features/groups/api/mutations', () => ({ assignTeacher: vi.fn() }));

import { assignTeacher } from '@/features/groups/api/mutations';
import { AssignReviewerDialog, type AssignTarget } from './assign-reviewer-dialog';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { teacherId: 'teacher-1', name: 'Marius Holt' },
        { teacherId: 'teacher-2', name: 'Per Nygård' },
      ],
    }),
  );
  vi.mocked(assignTeacher).mockResolvedValue({ ok: true });
});

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

  it('refuses to pretend it can help a learner who is in no group', async () => {
    renderDialog(submission({ unassigned: true, groupId: null }));

    expect(await screen.findByText('This learner is in no group')).toBeInTheDocument();
    // No form at all: an assignment here would be saved and change nothing.
    expect(screen.queryByLabelText('Teacher')).not.toBeInTheDocument();
  });
});
