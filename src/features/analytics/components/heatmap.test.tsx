import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

const labels = { student: 'Student', empty: 'Nobody yet' };
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
