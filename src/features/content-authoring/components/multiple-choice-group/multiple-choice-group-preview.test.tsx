import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceGroupContent } from '@/lib/shared-kernel/multiple-choice-group';
import {
  exercise,
  row,
  settings,
  RIGHT,
  WRONG,
} from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import { MultipleChoiceGroupPreview } from './multiple-choice-group-preview';

function renderPreview(ex: MultipleChoiceGroupContent = exercise()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MultipleChoiceGroupPreview exercise={ex} />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

/**
 * One answer pill.
 *
 * jsdom measures the panel at zero, so the body renders its card layout — where the
 * statement names the radio *group* and each pill carries only its column. The table's
 * cells read `"<statement> — <column>"`; both are the same control at two widths.
 */
function pill(statement: string, column: string) {
  return within(screen.getByRole('radiogroup', { name: statement })).getByRole('radio', {
    name: column,
  });
}

describe('MultipleChoiceGroupPreview', () => {
  it('says there is nothing to answer while no statement is finished', () => {
    renderPreview(exercise({ rows: [row('Halvveis.')] }));

    expect(screen.getByText(/Nothing to answer yet/)).toBeInTheDocument();
  });

  it('shows only the rows a student would be shown', () => {
    renderPreview(exercise({ rows: [row('Ferdig.', RIGHT.id), row('Halvveis.')] }));

    expect(screen.getByText('Ferdig.')).toBeInTheDocument();
    expect(screen.queryByText('Halvveis.')).toBeNull();
  });

  it('cannot be checked until every row is answered', async () => {
    const user = renderPreview(exercise({ rows: [row('En.', RIGHT.id), row('To.', WRONG.id)] }));

    expect(screen.getByRole('button', { name: /Check the answers/ })).toBeDisabled();

    await user.click(pill('En.', 'Riktig'));
    await user.click(pill('To.', 'Galt'));

    expect(screen.getByRole('button', { name: /Check the answers/ })).toBeEnabled();
  });

  it('checks the table with the author own key', async () => {
    const user = renderPreview(
      exercise({
        rows: [
          row('En.', RIGHT.id, { why: 'Fordi en.' }),
          row('To.', WRONG.id, { why: 'Fordi to.' }),
        ],
      }),
    );

    await user.click(pill('En.', 'Riktig'));
    await user.click(pill('To.', 'Riktig'));
    await user.click(screen.getByRole('button', { name: /Check the answers/ }));

    expect(screen.getByText('1 statement is wrong')).toBeInTheDocument();
    // The line of the row that was wrong, and not the one of the row that was right.
    expect(screen.getByText('Fordi to.')).toBeInTheDocument();
    expect(screen.queryByText('Fordi en.')).toBeNull();
  });

  it('withholds the key while a retry is still available', async () => {
    const user = renderPreview(
      exercise({
        rows: [row('En.', RIGHT.id), row('To.', WRONG.id)],
        settings: settings({ retry: 'one' }),
      }),
    );

    await user.click(pill('En.', 'Riktig'));
    await user.click(pill('To.', 'Riktig'));
    await user.click(screen.getByRole('button', { name: /Check the answers/ }));

    expect(screen.getByRole('button', { name: /Try the wrong ones again/ })).toBeInTheDocument();
    // Nothing on screen says which column «To.» belonged in.
    expect(pill('To.', 'Galt')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: /Finish/ })).toBeNull();
  });

  it('reopens the wrong rows on a retry and keeps the frozen ones', async () => {
    const user = renderPreview(
      exercise({
        rows: [row('En.', RIGHT.id), row('To.', WRONG.id)],
        settings: settings({ retry: 'one', lockCorrect: true }),
      }),
    );

    await user.click(pill('En.', 'Riktig'));
    await user.click(pill('To.', 'Riktig'));
    await user.click(screen.getByRole('button', { name: /Check the answers/ }));
    await user.click(screen.getByRole('button', { name: /Try the wrong ones again/ }));

    // The correct row keeps its answer and takes no more input; the wrong one is empty.
    expect(pill('En.', 'Riktig')).toHaveAttribute('aria-checked', 'true');
    expect(pill('En.', 'Riktig')).toBeDisabled();
    expect(pill('To.', 'Riktig')).toHaveAttribute('aria-checked', 'false');
    expect(pill('To.', 'Galt')).toBeEnabled();
  });

  it('closes the table on the first check when there is one attempt', async () => {
    const user = renderPreview(
      exercise({
        rows: [row('En.', RIGHT.id), row('To.', WRONG.id)],
        settings: settings({ retry: 'none' }),
      }),
    );

    await user.click(pill('En.', 'Riktig'));
    await user.click(pill('To.', 'Riktig'));
    await user.click(screen.getByRole('button', { name: /Check the answers/ }));

    expect(screen.queryByRole('button', { name: /Try the wrong ones again/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Finish/ })).toBeInTheDocument();
    expect(screen.getByText(/Not passed/)).toBeInTheDocument();
  });

  it('starts the attempt over when the author edits the table under it', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MultipleChoiceGroupPreview
          exercise={exercise({ rows: [row('En.', RIGHT.id), row('To.', WRONG.id)] })}
        />
      </NextIntlClientProvider>,
    );

    await user.click(pill('En.', 'Riktig'));
    expect(pill('En.', 'Riktig')).toHaveAttribute('aria-checked', 'true');

    // A third statement arrives: the standing answers are about a table that no longer
    // exists, so the panel starts again rather than carrying them over.
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MultipleChoiceGroupPreview
          exercise={exercise({
            rows: [row('En.', RIGHT.id), row('To.', WRONG.id), row('Tre.', RIGHT.id)],
          })}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('radiogroup', { name: 'Tre.' })).toBeInTheDocument();
    expect(pill('En.', 'Riktig')).toHaveAttribute('aria-checked', 'false');
  });

  it('offers a reshuffle only where the rows are shuffled', () => {
    renderPreview(exercise({ settings: settings({ shuffleRows: false }) }));
    expect(screen.queryByRole('button', { name: /Shuffle again/ })).toBeNull();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MultipleChoiceGroupPreview
          exercise={exercise({ settings: settings({ shuffleRows: true }) })}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('button', { name: /Shuffle again/ })).toBeInTheDocument();
  });
});
