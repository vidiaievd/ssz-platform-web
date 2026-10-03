import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { RECIPE_PRESETS } from '@/lib/shared-kernel/skills';
import type { CourseCoverageRecipe, Recipe } from '../types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/use-coverage-recipe', () => ({
  useCourseCoverageRecipe: vi.fn(),
  useSaveCourseCoverageRecipe: vi.fn(),
  InvalidRecipeError: class extends Error {},
}));

const { CourseRecipeField } = await import('./course-recipe-field');
const { useCourseCoverageRecipe, useSaveCourseCoverageRecipe } =
  await import('../api/use-coverage-recipe');

const WORKSPACE: Recipe = RECIPE_PRESETS.balanced_a1_a2;
const mutate = vi.fn();

function renderField(data: CourseCoverageRecipe) {
  vi.mocked(useCourseCoverageRecipe).mockReturnValue({ data, isPending: false } as never);
  vi.mocked(useSaveCourseCoverageRecipe).mockReturnValue({ mutate, isPending: false } as never);
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CourseRecipeField containerId="course-1" />
    </NextIntlClientProvider>,
  );
}

const save = () => screen.getByRole('button', { name: 'Save recipe' });

beforeEach(() => mutate.mockReset());

describe('CourseRecipeField', () => {
  it('shows the workspace rules a course inherits, and offers nothing to save', () => {
    renderField({ recipe: WORKSPACE, inherited: WORKSPACE, overridden: false });

    expect(screen.getByRole('radio', { name: /Use the workspace's recipe/ })).toBeChecked();
    expect(screen.getByText('at least 1 item — Material: Recording or Video')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('says plainly when there is nothing to inherit', () => {
    renderField({ recipe: { rules: [] }, inherited: null, overridden: false });

    expect(
      screen.getByText('Your workspace has no recipe, so lessons are not checked.'),
    ).toBeInTheDocument();
  });

  // Switching to "own" starts from what applies now: switching and saving at once
  // changes nothing, exactly as with the response time.
  it('starts its own recipe from the workspace one', () => {
    renderField({ recipe: WORKSPACE, inherited: WORKSPACE, overridden: false });

    fireEvent.click(screen.getByRole('radio', { name: /This course's own recipe/ }));
    fireEvent.click(save());

    expect(screen.getAllByRole('listitem', { name: /^Rule \d$/ })).toHaveLength(3);
    expect(mutate).toHaveBeenCalledWith(WORKSPACE, expect.anything());
  });

  it('hands the recipe back to the workspace with null', () => {
    renderField({ recipe: WORKSPACE, inherited: WORKSPACE, overridden: true });

    fireEvent.click(screen.getByRole('radio', { name: /Use the workspace's recipe/ }));
    fireEvent.click(save());

    expect(mutate).toHaveBeenCalledWith(null, expect.anything());
  });

  // "None" is a choice of its own; it is saved as an empty recipe, which the service keeps
  // as an override — not as "inherit".
  it('opts the course out with an empty recipe', () => {
    renderField({ recipe: WORKSPACE, inherited: WORKSPACE, overridden: false });

    fireEvent.click(screen.getByRole('radio', { name: /No recipe for this course/ }));
    fireEvent.click(save());

    expect(mutate).toHaveBeenCalledWith({ rules: [] }, expect.anything());
  });

  it('refuses to save a rule with no value, and says why', () => {
    renderField({ recipe: { rules: [] }, inherited: null, overridden: false });

    fireEvent.click(screen.getByRole('radio', { name: /This course's own recipe/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    expect(save()).toBeDisabled();
    expect(
      screen.getByText('Every rule needs at least one value and a sensible bound.'),
    ).toBeInTheDocument();

    const rule = screen.getByRole('listitem', { name: 'Rule 1' });
    fireEvent.click(within(rule).getByRole('checkbox', { name: 'Written in the target language' }));

    expect(save()).toBeEnabled();
    fireEvent.click(save());
    expect(mutate).toHaveBeenCalledWith(
      { rules: [{ axis: 'output', values: ['written_target'], min: 1 }] },
      expect.anything(),
    );
  });

  it('writes a ceiling as a share, from a percentage', () => {
    renderField({ recipe: { rules: [] }, inherited: null, overridden: false });

    fireEvent.click(screen.getByRole('radio', { name: /This course's own recipe/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    const rule = screen.getByRole('listitem', { name: 'Rule 1' });
    fireEvent.change(within(rule).getByRole('combobox', { name: 'What the rule counts by' }), {
      target: { value: 'modality' },
    });
    fireEvent.click(within(rule).getByRole('checkbox', { name: 'Picked out' }));
    fireEvent.change(within(rule).getByRole('combobox', { name: 'Bound' }), {
      target: { value: 'maxShare' },
    });
    fireEvent.change(within(rule).getByRole('spinbutton', { name: 'Amount' }), {
      target: { value: '40' },
    });
    fireEvent.click(save());

    expect(mutate).toHaveBeenCalledWith(
      { rules: [{ axis: 'modality', values: ['recognition'], maxShare: 0.4 }] },
      expect.anything(),
    );
  });

  it('replaces the rules with a preset', () => {
    renderField({ recipe: { rules: [] }, inherited: null, overridden: false });

    fireEvent.click(screen.getByRole('radio', { name: /This course's own recipe/ }));
    fireEvent.change(screen.getByRole('combobox', { name: /Start from/ }), {
      target: { value: 'grammar_intensive' },
    });
    fireEvent.click(save());

    expect(mutate).toHaveBeenCalledWith(RECIPE_PRESETS.grammar_intensive, expect.anything());
  });
});
