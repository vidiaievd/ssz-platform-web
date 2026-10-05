import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  addManualRow,
  emptyContent,
  sampleContent,
  stepState,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

vi.mock('../../api/use-course-dictionary', () => ({
  useCourseDictionary: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

const { InflectionTableBuilder } = await import('./builder');

const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };
const LOADED_AT = '2026-10-05T10:00:00.000Z';

const doc = (content: InflectionTableContent) => ({ ...content, updatedAt: LOADED_AT });

function renderBuilder(content: InflectionTableContent, onDocumentChange?: () => void) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InflectionTableBuilder
          exerciseId="ex-1"
          initialExercise={doc(content)}
          onDocumentChange={onDocumentChange}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

const stepTab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

describe('InflectionTableBuilder — rail (IT-B1)', () => {
  it('names the five steps with their subtitles', () => {
    renderBuilder(emptyContent('nb'));
    for (const [label, sub] of [
      ['Paradigm', 'columns from the pack'],
      ['Forms', 'lemmas and cells'],
      ['Reasons', 'why each form'],
      ['Difficulty', 'dials'],
      ['Audio', 'optional layer'],
    ] as const) {
      expect(within(stepTab(label)).getByText(sub)).toBeInTheDocument();
    }
  });

  it('shows the blockers of a blank draft from the first mount, steps 2 and 3 empty', () => {
    const blank = emptyContent('nb');
    renderBuilder(blank);
    expect(within(stepTab('Paradigm')).getByText('ready')).toBeInTheDocument();
    expect(stepState(blank, 2).errs).toBe(1);
    expect(within(stepTab('Forms')).getByText('1')).toBeInTheDocument();
    expect(within(stepTab('Reasons')).getByText('empty')).toBeInTheDocument();
  });

  it('puts the blockers of a language without a pack on step 1', () => {
    renderBuilder(emptyContent('xx'));
    expect(within(stepTab('Paradigm')).getByText('1 problem')).toBeInTheDocument();
  });

  it('counts the cells that lack a key on the rail as they are typed', async () => {
    const { user } = renderBuilder(addManualRow(emptyContent('nb')));
    // Three asked cells with no key, and a lemma missing: four blockers on step 2.
    expect(within(stepTab('Forms')).getByText('4')).toBeInTheDocument();
    await user.click(stepTab('Forms'));
    await user.type(screen.getByRole('textbox', { name: 'Lemma of row 1' }), 'en jobb');
    expect(within(stepTab('Forms')).getByText('3')).toBeInTheDocument();
  });
});

describe('InflectionTableBuilder — moving between steps', () => {
  it('opens on the paradigm and moves on with the step navigation', async () => {
    const { user } = renderBuilder(emptyContent('nb'));
    expect(stepTab('Paradigm')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Which system of forms' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Forms/ }));
    expect(stepTab('Forms')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'One table, not four gaps' })).toBeInTheDocument();
  });

  it('keeps what was written in step 1 when the author comes back from step 2', async () => {
    const { user } = renderBuilder(emptyContent('nb'));
    await user.type(screen.getByRole('textbox', { name: 'Instructions to the student' }), 'Bøy.');
    await user.click(stepTab('Forms'));
    await user.click(stepTab('Paradigm'));
    expect(screen.getByRole('textbox', { name: 'Instructions to the student' })).toHaveValue(
      'Bøy.',
    );
  });

  it('reports every change of the document to the page', async () => {
    const onChange = vi.fn();
    const { user } = renderBuilder(emptyContent('nb'), onChange);
    onChange.mockClear();
    await user.click(screen.getByRole('switch', { name: 'Bestemt flertall in the table' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ slots: ['indefSg', 'defSg', 'indefPl'] });
  });
});

describe('InflectionTableBuilder — the gate', () => {
  it('lists what stands in the way, each with the fix and a way to its step', async () => {
    const { user } = renderBuilder(emptyContent('nb'));
    await user.click(stepTab('Audio'));
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('No lemmas yet. The table has nothing to inflect.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Add lemmas/ }));
    expect(stepTab('Forms')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names a row’s problem by the row, not by a count', async () => {
    const { user } = renderBuilder(sampleContent({ rows: [] }));
    await user.click(stepTab('Audio'));
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    expect(await screen.findByText(/No lemmas yet/)).toBeInTheDocument();
  });
});

describe('InflectionTableBuilder — accessibility', () => {
  it('has no axe violations on either step', async () => {
    const { container, user } = renderBuilder(sampleContent());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await user.click(stepTab('Forms'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
