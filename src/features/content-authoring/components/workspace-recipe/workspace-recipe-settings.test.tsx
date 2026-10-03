import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { RECIPE_PRESETS } from '@/lib/shared-kernel/skills';
import type { WorkspaceCoverageRecipe } from '../../types';

// The real module pulls in next/navigation, which jsdom tests cannot load.
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), success: vi.fn() }),
}));
vi.mock('../../api/use-coverage-recipe', () => ({
  useWorkspaceCoverageRecipe: vi.fn(),
  useSaveWorkspaceCoverageRecipe: vi.fn(),
  useWorkspaceRecipeCourses: vi.fn(() => ({ data: undefined })),
  InvalidRecipeError: class InvalidRecipeError extends Error {},
  RecipeForbiddenError: class RecipeForbiddenError extends Error {},
}));

const { WorkspaceRecipeSettings } = await import('./workspace-recipe-settings');
const {
  useWorkspaceCoverageRecipe,
  useSaveWorkspaceCoverageRecipe,
  useWorkspaceRecipeCourses,
  InvalidRecipeError,
  RecipeForbiddenError,
} = await import('../../api/use-coverage-recipe');
const { toast } = await import('sonner');

type Callbacks = {
  onSuccess: (saved: WorkspaceCoverageRecipe) => void;
  onError: (e: Error) => void;
};
const mutate = vi.fn<(recipe: unknown, callbacks: Callbacks) => void>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSaveWorkspaceCoverageRecipe).mockReturnValue({ mutate, isPending: false } as never);
});

const SAVED: WorkspaceCoverageRecipe = {
  schoolId: 'school-1',
  recipe: RECIPE_PRESETS.balanced_a1_a2,
  updatedAt: '2026-10-02T18:00:00.000Z',
};

function renderPage(
  data: WorkspaceCoverageRecipe | undefined,
  { canEdit = false, isPending = false } = {},
) {
  vi.mocked(useWorkspaceCoverageRecipe).mockReturnValue({
    data,
    isPending,
    isError: false,
  } as never);
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      <WorkspaceRecipeSettings schoolId="school-1" canEdit={canEdit} kind="school" />
    </NextIntlClientProvider>,
  );
}

describe('WorkspaceRecipeSettings, read-only', () => {
  it('says it is loading while the recipe is on its way', () => {
    renderPage(undefined, { isPending: true });

    expect(screen.getByRole('status')).toHaveTextContent('Loading the lesson recipe…');
  });

  it('shows the saved rules, the preset they are, and that only owners may change them', () => {
    renderPage(SAVED);

    expect(screen.getByText(/View only\. Owners and content admins/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Balanced A1–A2/ })).toBeChecked();
    expect(screen.getAllByRole('listitem', { name: /^Rule \d$/ })).toHaveLength(3);
    expect(screen.getByText('3 of 20')).toBeInTheDocument();
    expect(screen.getByText('View only · Last saved Oct 2, 2026')).toBeInTheDocument();
  });

  it('offers no control to change a rule', () => {
    renderPage(SAVED);

    const rule = screen.getByRole('listitem', { name: 'Rule 1' });
    expect(
      within(rule).getByRole('combobox', { name: 'Rule 1 — What the rule counts by' }),
    ).toBeDisabled();
    expect(within(rule).queryByRole('button', { name: 'Delete rule 1' })).toBeNull();
    for (const chip of within(rule).getAllByRole('checkbox')) expect(chip).toBeDisabled();
  });

  it('reads each rule exactly as the course tree does', () => {
    renderPage(SAVED);

    expect(
      within(screen.getByRole('listitem', { name: 'Rule 2' })).getByText(
        'at least 1 item — Material: Recording or Video',
      ),
    ).toBeInTheDocument();
  });

  // Never set and set-to-nothing are different states, and say different things.
  it('tells a recipe never set from one set to no rules', () => {
    const { unmount } = renderPage({ ...SAVED, recipe: null, updatedAt: null });
    expect(
      screen.getByText('No recipe yet, so lessons in this workspace are not checked.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No rules yet')).toBeInTheDocument();
    expect(screen.getByText('Not set yet')).toBeInTheDocument();
    unmount();

    renderPage({ ...SAVED, recipe: { rules: [] } });
    expect(screen.getByText('No rules: lessons will not be checked')).toBeInTheDocument();
    expect(screen.queryByText(/No recipe yet/)).toBeNull();
  });
});

const saveButton = () => screen.getByRole('button', { name: 'Save recipe' });
const lastToast = () => vi.mocked(toast).mock.calls.at(-1)!;
const undoLast = () =>
  (lastToast()[1] as unknown as { action: { onClick: () => void } }).action.onClick();

describe('WorkspaceRecipeSettings, editing', () => {
  it('starts a recipe that was never set from a preset, without badges', () => {
    renderPage({ ...SAVED, recipe: null, updatedAt: null }, { canEdit: true });
    expect(screen.getByText('Nothing to save yet')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /B1 exam preparation/ }));

    expect(screen.getAllByRole('listitem', { name: /^Rule \d$/ })).toHaveLength(4);
    expect(screen.queryByText('New')).toBeNull();
    expect(screen.queryByText(/No recipe yet/)).toBeNull();
    expect(lastToast()[0]).toBe('B1 exam preparation added. Review the rules, then save.');
    expect(saveButton()).toBeEnabled();
  });

  it('replaces rules with a preset, and undoes it', () => {
    renderPage(SAVED, { canEdit: true });

    fireEvent.click(screen.getByRole('radio', { name: /Grammar intensive/ }));
    expect(lastToast()[0]).toBe('Rules replaced with Grammar intensive.');
    expect(screen.getByRole('radio', { name: /Grammar intensive/ })).toBeChecked();

    act(() => undoLast());
    expect(screen.getByRole('radio', { name: /Balanced A1–A2/ })).toBeChecked();
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  it('marks an edited rule, keeps the preset it came from, and discards back', () => {
    renderPage(SAVED, { canEdit: true });

    const rule = screen.getByRole('listitem', { name: 'Rule 3' });
    fireEvent.change(
      within(rule).getByRole('textbox', { name: 'Rule 3 — Share of items, percent' }),
      {
        target: { value: '70' },
      },
    );

    expect(within(rule).getByText('Edited')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Balanced A1–A2/ })).toBeChecked();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByText('Edited')).toBeNull();
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  it('holds back a new rule until a value is ticked', () => {
    renderPage(SAVED, { canEdit: true });

    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    const rule = screen.getByRole('listitem', { name: 'Rule 4' });
    expect(within(rule).getByText('New')).toBeInTheDocument();
    expect(
      within(rule).getByRole('combobox', { name: 'Rule 4 — What the rule counts by' }),
    ).toHaveFocus();
    expect(within(rule).getByText('Tick at least one value.')).toBeInTheDocument();
    expect(screen.getByText('Rule 4 needs a fix before you can save.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.click(within(rule).getByRole('checkbox', { name: 'Picture' }));
    expect(saveButton()).toBeEnabled();
  });

  it('deletes a rule with an undo, and moves focus to the next one', () => {
    renderPage(SAVED, { canEdit: true });

    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    expect(screen.getAllByRole('listitem', { name: /^Rule \d$/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Delete rule 1' })).toHaveFocus();
    expect(lastToast()[0]).toBe('Rule 1 deleted.');

    act(() => undoLast());
    expect(screen.getAllByRole('listitem', { name: /^Rule \d$/ })).toHaveLength(3);
  });

  // Saving the last rule away is a choice: it turns the check off.
  it('saves a recipe of no rules as such', () => {
    renderPage(SAVED, { canEdit: true });
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));

    expect(screen.getByText('No rules: lessons will not be checked')).toBeInTheDocument();
    fireEvent.click(saveButton());
    expect(mutate).toHaveBeenCalledWith({ rules: [] }, expect.anything());
  });

  it('saves, and says so', () => {
    renderPage(SAVED, { canEdit: true });
    fireEvent.click(screen.getByRole('radio', { name: /Grammar intensive/ }));
    fireEvent.click(saveButton());

    expect(mutate).toHaveBeenCalledWith(RECIPE_PRESETS.grammar_intensive, expect.anything());
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    act(() =>
      mutate.mock.calls[0]![1].onSuccess({
        ...SAVED,
        recipe: RECIPE_PRESETS.grammar_intensive,
        updatedAt: '2026-10-03T08:00:00.000Z',
      }),
    );
    expect(screen.getByText('Saved just now')).toBeInTheDocument();
    expect(screen.getByText('Last saved Oct 3, 2026')).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  // BEHAVIOR §5: an edit made while the save was in flight stays a draft.
  it('keeps an edit made during the save as unsaved', () => {
    renderPage(SAVED, { canEdit: true });
    fireEvent.click(screen.getByRole('radio', { name: /Grammar intensive/ }));
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));

    act(() => mutate.mock.calls[0]![1].onSuccess(SAVED));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('keeps the edits and offers to try again when the save fails', () => {
    renderPage(SAVED, { canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    fireEvent.click(saveButton());

    act(() => mutate.mock.calls[0]![1].onError(new Error('offline')));
    expect(
      screen.getByText('Couldn’t save. Check your connection and try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getAllByRole('listitem', { name: /^Rule \d$/ })).toHaveLength(2);
  });

  it('holds a refused recipe back until it changes', () => {
    renderPage(SAVED, { canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    fireEvent.click(saveButton());

    act(() => mutate.mock.calls[0]![1].onError(new InvalidRecipeError('no')));
    expect(screen.getByText('Not saved: the server didn’t accept the recipe.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    expect(saveButton()).toBeEnabled();
  });

  it('turns read-only when the service refuses the role', () => {
    renderPage(SAVED, { canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    fireEvent.click(saveButton());

    act(() => mutate.mock.calls[0]![1].onError(new RecipeForbiddenError('no')));
    expect(screen.getByText(/View only\. Owners and content admins/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save recipe' })).toBeNull();
  });
});

describe('WorkspaceRecipeSettings, what it will advise', () => {
  const advise = () =>
    screen.getByRole('heading', { name: 'What this recipe will advise' }).closest('section')!;

  it('names the types that close a floor and keep a ceiling under', () => {
    renderPage(SAVED);

    const card = advise();
    expect(within(card).getAllByText('Closes it:')).not.toHaveLength(0);
    expect(within(card).getByText('Keeps it under:')).toBeInTheDocument();
  });

  it('shows five types, then the rest on request', () => {
    renderPage(SAVED);

    const more = within(advise()).getByRole('button', {
      name: /^Show \d+ more exercise types for rule 1$/,
    });
    const row = more.closest('li')!;
    const before = row.querySelectorAll('span.rounded-\\[4px\\]').length;
    fireEvent.click(more);
    expect(row.querySelectorAll('span.rounded-\\[4px\\]').length).toBeGreaterThan(before);
    expect(within(row).queryByRole('button', { name: /more exercise types/ })).toBeNull();
  });

  // Nothing on the platform is heard by default; the audio layer is what makes it so.
  it('suggests a recording for a rule about hearing', () => {
    renderPage(SAVED);

    expect(within(advise()).getByText('or turn on a recording in an exercise')).toBeInTheDocument();
  });

  it('asks for the fix before advising on an unfinished rule', () => {
    renderPage(SAVED, { canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(within(advise()).getByText('Fix rule 4 to see what closes it.')).toBeInTheDocument();
  });

  it('is not shown without rules', () => {
    renderPage({ ...SAVED, recipe: { rules: [] } });

    expect(screen.queryByRole('heading', { name: 'What this recipe will advise' })).toBeNull();
  });
});

describe('WorkspaceRecipeSettings, courses', () => {
  const COURSES = {
    total: 4,
    follow: 2,
    own: 1,
    none: 1,
    exceptions: [
      { courseId: 'b1', title: 'Norsk B1', mode: 'own' as const, ruleCount: 4 },
      { courseId: 'drift', title: 'Norsk drift', mode: 'none' as const, ruleCount: 0 },
    ],
  };

  it('counts the courses and links the ones that differ to their settings', () => {
    vi.mocked(useWorkspaceRecipeCourses).mockReturnValue({ data: COURSES } as never);
    renderPage(SAVED);

    expect(
      screen.getByText('How the 4 courses in this workspace use the recipe.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Follow this recipe').previousSibling).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: 'Norsk B1' })).toHaveAttribute(
      'href',
      expect.stringContaining('/w/school-1/content/b1?settings=1'),
    );
    expect(screen.getByText('Own recipe · 4 rules')).toBeInTheDocument();
    expect(screen.getByText('No recipe')).toBeInTheDocument();
  });

  it('says it in one line while nothing is saved', () => {
    vi.mocked(useWorkspaceRecipeCourses).mockReturnValue({ data: COURSES } as never);
    renderPage({ ...SAVED, recipe: null, updatedAt: null });

    expect(
      screen.getByText(
        'All 4 courses inherit the workspace recipe. Until one is saved, nothing is checked.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Courses that differ')).toBeNull();
  });

  it('is not drawn without data', () => {
    vi.mocked(useWorkspaceRecipeCourses).mockReturnValue({ data: undefined } as never);
    renderPage(SAVED);

    expect(screen.queryByRole('heading', { name: 'Courses' })).toBeNull();
  });
});
