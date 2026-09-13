import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Heatmap } from './heatmap';
import type { HeatmapRow } from '../types';

const units = [1, 2, 3].map((no) => ({ unitId: `u${no}`, no, title: `Leksjon ${no}` }));

const row = (
  studentId: string,
  displayName: string,
  cells: HeatmapRow['cells'],
  lastActivityAt: string | null = '2026-09-10T00:00:00.000Z',
): HeatmapRow => ({ studentId, displayName, lastActivityAt, cells });

const measured = (value: number) => ({ state: 'ok' as const, value, weightedSample: 12 });
const untouched = { state: 'notStarted' as const, value: null, weightedSample: 0 };
const untaught = { state: 'notDelivered' as const, value: null, weightedSample: 0 };

const labels = {
  student: 'Student',
  empty: 'Nobody yet',
  grid: 'Every learner against every unit',
};
const tip = (r: HeatmapRow, u: { no: number }) => `${r.displayName} · Unit ${u.no}`;

describe('the map shows everybody', () => {
  it('keeps a learner with no data as a full row of named emptiness', () => {
    render(
      <Heatmap
        units={units}
        rows={[
          row('a', 'Anna', [measured(70), measured(60), untouched]),
          row('b', 'Bjørn', [untouched, untouched, untouched], null),
        ]}
        tip={tip}
        labels={labels}
      />,
    );

    expect(screen.getByText('Bjørn')).toBeTruthy();
    // Three cells for Bjørn too, not an absent row and not a row of zeroes.
    expect(screen.getAllByTitle(/Bjørn/)).toHaveLength(3);
  });

  it('says so when the roster is empty rather than drawing a frame around nothing', () => {
    render(<Heatmap units={units} rows={[]} tip={tip} labels={labels} />);
    expect(screen.getByText('Nobody yet')).toBeTruthy();
  });
});

describe('ordering', () => {
  const rows = [
    row('a', 'Anna', [measured(90), measured(90), measured(90)]),
    row('b', 'Bjørn', [measured(10), measured(20), measured(10)]),
    row('c', 'Cecilie', [untouched, untouched, untouched]),
  ];

  const namesIn = (container: HTMLElement) =>
    [...container.querySelectorAll('.truncate')].map((el) => el.textContent);

  it('keeps the roster order by default', () => {
    const { container } = render(
      <Heatmap units={units} rows={rows} tip={tip} labels={labels} sort="roster" />,
    );
    expect(namesIn(container)).toEqual(['Anna', 'Bjørn', 'Cecilie']);
  });

  it('puts the lowest first, and the unmeasured last rather than at the top', () => {
    const { container } = render(
      <Heatmap units={units} rows={rows} tip={tip} labels={labels} sort="lowest" />,
    );

    // Cecilie has no measured cell at all. Leading the list she would read as the worst
    // in the class, when the truth is that nobody knows anything about her yet.
    expect(namesIn(container)).toEqual(['Bjørn', 'Anna', 'Cecilie']);
  });

  it('ranks by how it went, not by how much was attempted', () => {
    const thin = row('t', 'Thin', [measured(80), untouched, untouched]);
    const busy = row('u', 'Busy', [measured(50), measured(50), measured(50)]);

    const { container } = render(
      <Heatmap units={units} rows={[thin, busy]} tip={tip} labels={labels} sort="lowest" />,
    );

    // A sum would put Thin (80) below Busy (150); the mean puts the struggling one first.
    expect(namesIn(container)).toEqual(['Busy', 'Thin']);
  });
});

describe('what a cell does when clicked', () => {
  it('links only from a measured cell', () => {
    render(
      <Heatmap
        units={units}
        rows={[row('a', 'Anna', [measured(70), untaught, untouched])]}
        tip={tip}
        href={(r, u) => (u.no === 1 ? `/students/${r.studentId}?unit=${u.unitId}` : null)}
        labels={labels}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/students/a?unit=u1');
  });

  it('leaves an untaught cell inert, with words rather than a destination', () => {
    render(
      <Heatmap
        units={units}
        rows={[row('a', 'Anna', [untaught, untaught, untaught])]}
        tip={tip}
        href={() => null}
        labels={labels}
      />,
    );

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getAllByTitle('Anna · Unit 1')).toHaveLength(1);
  });
});

describe('walking the map without a mouse', () => {
  const grid = () =>
    render(
      <Heatmap
        units={units}
        rows={[
          row('a', 'Anna', [measured(70), measured(40), untouched]),
          row('b', 'Bjørn', [untouched, measured(55), untaught]),
        ]}
        tip={tip}
        labels={labels}
      />,
    );

  it('is one tab stop, not four hundred', () => {
    grid();

    const cells = screen.getAllByRole('gridcell');
    expect(cells.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('moves with the arrow keys, including across empty cells', async () => {
    const user = userEvent.setup();
    grid();

    const cells = screen.getAllByRole('gridcell');
    await user.tab();
    expect(cells[0]).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(cells[1]).toHaveFocus();

    // Down a row and onto a cell nobody has touched: the empty ones are most of what
    // this map says, and skipping them would hide exactly that.
    await user.keyboard('{ArrowDown}');
    expect(cells[4]).toHaveFocus();
    expect(cells[4]?.getAttribute('aria-label')).toContain('Bjørn');
  });

  it('stops at the edges rather than wrapping onto another learner', async () => {
    const user = userEvent.setup();
    grid();

    const cells = screen.getAllByRole('gridcell');
    await user.tab();
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(cells[0]).toHaveFocus();
  });

  it('opens a measured cell on Enter', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    render(
      <Heatmap
        units={units}
        rows={[row('a', 'Anna', [measured(70), untouched, untouched])]}
        tip={tip}
        href={(r, u) => (u.no === 1 ? `/students/${r.studentId}?unit=${u.unitId}` : null)}
        onOpen={onOpen}
        labels={labels}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/students/a?unit=u1');

    vi.unstubAllGlobals();
  });

  it('does nothing on Enter where the cell leads nowhere', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    render(
      <Heatmap
        units={units}
        rows={[row('a', 'Anna', [untaught, untaught, untaught])]}
        tip={tip}
        href={() => null}
        labels={labels}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    expect(assign).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
