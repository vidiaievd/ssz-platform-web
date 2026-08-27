import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';
import {
  chunk,
  content,
  row,
  schema,
} from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';

import { StepSchema } from './step-schema';
import type { SentenceSchemaDocument } from './edits';

vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => `${Math.random().toString(36).slice(2, 10)}-0000-0000-0000-000000000000`,
});

function doc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaDocument {
  return { updatedAt: '2026-08-26T10:00:00.000Z', ...content(overrides) };
}

function Harness({
  initial,
  onChange,
  targetLanguage = 'nb',
}: {
  initial: SentenceSchemaDocument;
  onChange?: (next: SentenceSchemaDocument) => void;
  targetLanguage?: string;
}) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepSchema
        exercise={exercise}
        targetLanguage={targetLanguage}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: SentenceSchemaDocument = doc(), targetLanguage = 'nb') {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} targetLanguage={targetLanguage} />);
  return { user: userEvent.setup(), onChange };
}

/** The document as the sequence-only mode leaves it. */
function seqDoc(): SentenceSchemaDocument {
  const base = doc();
  return { ...base, settings: { ...base.settings, orderOnly: true } };
}

describe('StepSchema', () => {
  it('warns that a pack switch clears the placements — before the click, not after', () => {
    renderStep();

    expect(
      screen.getByText(
        'Switching the pack clears every word you have already placed in step 2. There is no undo for it.',
      ),
    ).toBeInTheDocument();
  });

  it('says nothing about losing work when there is none to lose', () => {
    renderStep(doc({ rows: [row({ chunks: [chunk('c1', 'skal')] })] }));

    expect(screen.queryByText(/Switching the pack clears/)).not.toBeInTheDocument();
  });

  it('replaces the schema and clears every placement when a pack is chosen', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('radio', { name: /Setningsskjema — enkelt/ }));

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.presetId).toBe('nb-simple');
    expect(latest.rows[0]!.chunks.every((c) => c.field === null)).toBe(true);
  });

  it('opens the field editor on a clause type the moment it is switched on', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('button', { name: /Subordinate clause/ }));

    // The editor jumped: the subordinate clause of this document has no fields yet.
    expect(
      screen.getByText('This clause type has no fields yet — add one, or switch the type off.'),
    ).toBeInTheDocument();
  });

  it('reports a switched-on clause type with no fields as a blocker, on the step', () => {
    renderStep(doc({ clauses: ['main', 'sub'], schema: schema() }));

    expect(
      screen.getByText('Subordinate clause is switched on but has no fields.'),
    ).toBeInTheDocument();
  });

  it('warns — and does not block — when a sentence uses a switched-off type', () => {
    renderStep(doc({ clauses: ['sub'], schema: { ...schema(), sub: schema().main } }));

    expect(
      screen.getByText('Sentence 1 uses Main clause, which is switched off.'),
    ).toBeInTheDocument();
  });

  it('renames a field without disturbing what is placed in it', async () => {
    const { user, onChange } = renderStep();

    await user.type(screen.getAllByLabelText('Field name')[0]!, '!');

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.schema.main[0]!.label).toBe('Forfelt!');
    expect(latest.rows[0]!.chunks[0]!.field).toBe('F');
  });

  it('sends the words of a deleted field back to the bank', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getAllByRole('button', { name: 'Remove field' })[0]!);

    const latest = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(latest.schema.main).toHaveLength(5);
    expect(latest.rows[0]!.chunks[0]!.field).toBeNull();
  });

  it('will not move the first field left or the last one right', () => {
    renderStep();

    expect(screen.getAllByRole('button', { name: 'Move left' })[0]!).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Move right' }).at(-1)!).toBeDisabled();
  });

  it('adds a field that may stay empty, keyed by its position', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Add field' }));

    const added = (onChange.mock.lastCall![0] as SentenceSchemaDocument).schema.main.at(-1)!;
    expect(added).toMatchObject({ short: '7', label: 'New field', optional: true });
  });
});

describe('StepSchema · packs are offered by the language of the course', () => {
  it('offers the packs of the course language, and not the others', () => {
    renderStep(doc(), 'nb');

    expect(screen.getByRole('radio', { name: /Setningsskjema — fullt/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Tomt skjema/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Topologisches Feldermodell/ }),
    ).not.toBeInTheDocument();
  });

  it('offers the German pack to a German course', () => {
    // From `blank`, so that the "keep what is selected" rule is not what is being read.
    renderStep({ ...doc(), presetId: 'blank' }, 'de');

    expect(screen.getByRole('radio', { name: /Topologisches Feldermodell/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Setningsskjema — fullt/ })).not.toBeInTheDocument();
  });

  it('offers the blank pack alone for a language with no chart, and points at the other mode', () => {
    renderStep({ ...doc(), presetId: 'blank' }, 'uk');

    expect(screen.getByRole('radio', { name: /Tomt skjema/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Setningsskjema/ })).not.toBeInTheDocument();
    expect(screen.getByText(/no field chart for this course/i)).toBeInTheDocument();
  });

  it('keeps the pack the exercise already sits on, however foreign to the course', () => {
    const base = doc();
    renderStep({ ...base, presetId: 'de-topo' }, 'nb');

    // Filtering it out would leave the author's own selection invisible in the grid.
    expect(screen.getByRole('radio', { name: /Topologisches Feldermodell/ })).toBeInTheDocument();
  });

  it('shows the packs of other languages on request', async () => {
    const { user } = renderStep(doc(), 'nb');

    await user.click(screen.getByRole('button', { name: /Show packs for other languages/ }));

    expect(screen.getByRole('radio', { name: /Topologisches Feldermodell/ })).toBeInTheDocument();
  });
});

describe('StepSchema · the mode cards', () => {
  it('writes the sequence-only mode without touching the schema', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('radio', { name: /Word order only/ }));

    const next = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(next.settings.orderOnly).toBe(true);
    expect(next.schema).toEqual(doc().schema);
  });

  it('folds the schema away in sequence-only mode, but keeps it reachable', () => {
    renderStep(seqDoc());

    /*
      Inside a closed disclosure rather than gone: the schema is what the exercise returns
      to when the mode is switched back, so the author has to be able to reach and edit it.
      Asserted through the DOM because jsdom does not hide the contents of a closed
      `<details>` the way a browser does.
    */
    const details = screen
      .getByRole('radio', { name: /Setningsskjema — fullt/ })
      .closest('details');
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(screen.getByText(/Field schema — kept/)).toBeInTheDocument();
  });

  it('goes back to laying out by field', async () => {
    const { user, onChange } = renderStep(seqDoc());

    await user.click(screen.getByRole('radio', { name: /Lay the sentence out by field/ }));

    expect((onChange.mock.lastCall![0] as SentenceSchemaDocument).settings.orderOnly).toBe(false);
  });
});
