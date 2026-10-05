import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import {
  addManualRow,
  emptyContent,
  sampleContent,
  stepState,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));
vi.mock('../../actions/inflection-table', () => ({ saveInflectionTableAction: vi.fn() }));
vi.mock('../../api/use-course-dictionary', () => ({
  useCourseDictionary: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));

const { InflectionTableBuilder } = await import('./builder');
const { saveInflectionTableAction } = await import('../../actions/inflection-table');

const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };
const LOADED_AT = '2026-10-05T10:00:00.000Z';

const doc = (content: InflectionTableContent) => ({
  ...content,
  updatedAt: LOADED_AT,
  audio: readAudioDraft({}, 'inflection_table'),
});

function renderBuilder(content: InflectionTableContent, onDocumentChange?: () => void) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InflectionTableBuilder
          exerciseId="ex-1"
          containerId="module-1"
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

describe('InflectionTableBuilder — steps 3 to 5', () => {
  it('opens reasons, difficulty and audio from the rail', async () => {
    const { user } = renderBuilder(sampleContent());
    await user.click(stepTab('Reasons'));
    expect(
      screen.getByRole('heading', { name: 'Why this form and not that one' }),
    ).toBeInTheDocument();
    await user.click(stepTab('Difficulty'));
    expect(
      screen.getByRole('heading', { name: 'Dials, kept away from content' }),
    ).toBeInTheDocument();
    await user.click(stepTab('Audio'));
    expect(
      screen.getByRole('heading', { name: 'Optional, and attached the usual way' }),
    ).toBeInTheDocument();
  });

  it('puts a blocker on the reasons step as soon as a key has none (IT-B8)', () => {
    const base = sampleContent();
    const row = base.rows[0]!;
    const cells = Object.fromEntries(
      Object.entries(row.cells).map(([id, c]) => [id, { ...c, why: '' }]),
    );
    renderBuilder({ ...base, rows: [{ ...row, cells }, ...base.rows.slice(1)] });
    expect(within(stepTab('Reasons')).getByText('3 problems')).toBeInTheDocument();
  });

  it('folds the audio layer’s findings into step 5 (IT-B12)', async () => {
    const { user } = renderBuilder(sampleContent());
    expect(within(stepTab('Audio')).getByText('ready')).toBeInTheDocument();
    await user.click(stepTab('Audio'));
    await user.click(
      screen.getByRole('switch', { name: new RegExp(enMessages.Authoring.audio.enableLabel) }),
    );
    // Listening on, with no clip behind it: nothing to play.
    expect(within(stepTab('Audio')).getByText(/problem/)).toBeInTheDocument();
  });
});

describe('InflectionTableBuilder — the gate', () => {
  it('adds up repeated findings into one line with a number, and lists what already passes', async () => {
    const base = sampleContent();
    const rows = base.rows.map((row) => ({
      ...row,
      cells: Object.fromEntries(
        Object.entries(row.cells).map(([id, c]) => [id, { ...c, why: '' }]),
      ),
    }));
    const { user } = renderBuilder({ ...base, rows });
    await user.click(stepTab('Audio'));
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    const dialog = await screen.findByRole('dialog');
    const asked = rows.length * 3;
    expect(
      within(dialog).getByText(`${asked} cells would tell the student “wrong” with no reason.`),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText(/would tell the student/)).toHaveLength(1);
    expect(
      within(dialog).getByText(/Columns come from Norsk bokmål · kjernepakke/),
    ).toBeInTheDocument();
  });

  it('names a single finding by its row and column', async () => {
    const base = sampleContent();
    const row = base.rows[0]!;
    const cells = { ...row.cells, defSg: { ...row.cells['defSg']!, why: '' } };
    const { user } = renderBuilder({ ...base, rows: [{ ...row, cells }, ...base.rows.slice(1)] });
    await user.click(stepTab('Audio'));
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/en jobb · Bestemt entall — This cell would tell the student/),
    ).toBeInTheDocument();
  });

  it('says it is clear for a finished table', async () => {
    const { user } = renderBuilder(sampleContent());
    await user.click(stepTab('Audio'));
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Nothing standing in the way/)).toBeInTheDocument();
  });
});

describe('InflectionTableBuilder — saving', () => {
  beforeEach(() => {
    vi.mocked(saveInflectionTableAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', updatedAt: '2026-10-05T10:00:05.000Z' },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('saves an edit by itself, both columns, on the token it loaded with', async () => {
    const { user } = renderBuilder(sampleContent());
    await user.type(screen.getByRole('textbox', { name: 'Instructions to the student' }), '!');
    await vi.waitFor(() => expect(saveInflectionTableAction).toHaveBeenCalledTimes(1), {
      timeout: 3_000,
    });
    const [exerciseId, containerId, input] = vi.mocked(saveInflectionTableAction).mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['ex-1', 'module-1']);
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.instructions.endsWith('!')).toBe(true);
    expect(input.expectedAnswers.cells['r1:defSg']?.value).toBe('jobben');
  });

  it('offers to put the exercise back once something changed, and does', async () => {
    const { user } = renderBuilder(sampleContent());
    expect(screen.queryByRole('button', { name: /Undo everything/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Bestemt flertall in the table' }));
    await user.click(screen.getByRole('button', { name: /Undo everything since I opened this/ }));
    await user.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(screen.getByRole('switch', { name: 'Bestemt flertall in the table' })).toBeChecked();
  });
});
