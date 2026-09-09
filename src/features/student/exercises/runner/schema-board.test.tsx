import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Field } from '@/lib/shared-kernel/sentence-schema';

import { fitsAsColumns, SchemaBoard, type BoardLayout } from './schema-board';

/**
 * The layout rule, on its own.
 *
 * It lives here rather than in a render test because jsdom measures nothing: every
 * component test runs with a container width of 0 and therefore in the rows layout, so
 * the one decision worth pinning would never be exercised.
 */
describe('fitsAsColumns', () => {
  it('needs 104px per field plus the gaps between them', () => {
    // Seven fields: 7 × 104 + 6 × 6 = 764.
    expect(fitsAsColumns(764, 7)).toBe(true);
    expect(fitsAsColumns(763, 7)).toBe(false);
  });

  it('asks about this schema, not about the screen', () => {
    // The same width that cannot hold the full Norwegian chart holds a four-field one —
    // which is why a fixed breakpoint was the wrong question.
    expect(fitsAsColumns(600, 7)).toBe(false);
    expect(fitsAsColumns(600, 4)).toBe(true);
  });

  it('treats a schema with no fields as fitting', () => {
    // Nothing to draw cannot overflow, and the alternative would put an empty board in
    // the phone layout on a desktop for no reason.
    expect(fitsAsColumns(0, 0)).toBe(true);
  });

  it('sends a single field to columns even in a narrow pane', () => {
    expect(fitsAsColumns(104, 1)).toBe(true);
    expect(fitsAsColumns(103, 1)).toBe(false);
  });
});

const FIELDS: Field[] = [
  {
    id: 'F',
    short: 'F',
    label: 'Forfelt',
    hint: 'Ett ledd — det setningen starter med',
    optional: true,
  },
  {
    id: 'v',
    short: 'v',
    label: 'Finitt verbal',
    hint: 'Det bøyde verbet — alltid på plass to',
    optional: false,
  },
];

function renderBoard(layout: BoardLayout) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SchemaBoard
        fields={FIELDS}
        placement={{}}
        textOf={() => ''}
        layout={layout}
        labels
        hints
        counts={null}
        marks={null}
        selectedField={null}
        accent="#3d7f6a"
      />
    </NextIntlClientProvider>,
  );
}

/**
 * Where the hint goes, in both layouts.
 *
 * Twice now this has been got wrong in the same way — the hint put inside the head, where
 * as columns it stretches the field past every other one, and as rows it wraps three deep
 * inside a 96px label column and doubles the height of every row. The rule is one line
 * long and worth a test precisely because nothing about it is visible in jsdom: it is a
 * fact about which element contains which, and that much can be asserted.
 */
describe('SchemaBoard · the hint is never inside the head', () => {
  it.each<BoardLayout>(['cols', 'rows'])('keeps it out of the label element (%s)', (layout) => {
    renderBoard(layout);

    const label = screen.getByText('Forfelt');
    const hint = screen.getByText('Ett ledd — det setningen starter med');

    expect(label.parentElement).not.toBeNull();
    expect(label.parentElement!.contains(hint)).toBe(false);
  });

  it('draws the short key and the name for every field', () => {
    renderBoard('rows');

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('Finitt verbal')).toBeInTheDocument();
  });
});
