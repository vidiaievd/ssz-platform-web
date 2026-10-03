import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { RECIPE_PRESETS } from '@/lib/shared-kernel/skills';
import type { WorkspaceCoverageRecipe } from '../../types';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));
vi.mock('../../api/use-coverage-recipe', () => ({
  useWorkspaceCoverageRecipe: vi.fn(),
  useSaveWorkspaceCoverageRecipe: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  InvalidRecipeError: class extends Error {},
  RecipeForbiddenError: class extends Error {},
}));

const { WorkspaceRecipeSettings } = await import('./workspace-recipe-settings');
const { useWorkspaceCoverageRecipe } = await import('../../api/use-coverage-recipe');

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
