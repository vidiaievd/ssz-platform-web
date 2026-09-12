import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeliveredAbsorbed, type ChartAbsorbed, type ChartDelivered } from './delivered-absorbed';

const units = [1, 2, 3, 4].map((no) => ({ unitId: `u${no}`, no, title: `Leksjon ${no}` }));

const measured = (median: number): ChartAbsorbed => ({
  state: 'ok',
  median,
  p25: median - 10,
  p75: median + 10,
});

const taught: ChartDelivered[] = units.map(() => ({ value: 1 }));

const pathsOf = (container: HTMLElement, stroke: string) =>
  [...container.querySelectorAll('path')].filter((p) => p.getAttribute('stroke') === stroke);

const ABSORBED = 'oklch(var(--ssz-primary-ch))';
const DELIVERED = 'var(--ssz-text-primary)';

describe('the absorbed line breaks where the data does', () => {
  it('draws one run when every unit is measured', () => {
    const { container } = render(
      <DeliveredAbsorbed
        units={units}
        delivered={taught}
        absorbed={units.map((_, i) => measured(50 + i * 5))}
        quality={{}}
      />,
    );

    expect(pathsOf(container, ABSORBED)).toHaveLength(1);
  });

  it('splits the line around a unit nobody attempted', () => {
    const { container } = render(
      <DeliveredAbsorbed
        units={units}
        delivered={taught}
        absorbed={[
          measured(60),
          { state: 'notStarted', median: null, p25: null, p75: null },
          measured(70),
          measured(75),
        ]}
        quality={{}}
      />,
    );

    // Two runs, not one line drawn straight through the hole — a continuous line there
    // would invent a number for a unit nobody has touched.
    expect(pathsOf(container, ABSORBED)).toHaveLength(2);
  });

  it('never joins across a unit it cannot judge, even with a median to hand', () => {
    const { container } = render(
      <DeliveredAbsorbed
        units={units}
        delivered={taught}
        absorbed={[
          measured(60),
          { state: 'insufficient', median: 55, p25: 55, p75: 55 },
          measured(70),
          measured(75),
        ]}
        quality={{}}
      />,
    );

    expect(pathsOf(container, ABSORBED)).toHaveLength(2);
    // …and the unjudgeable unit is marked rather than dropped.
    expect(container.querySelector('text[font-weight="800"]')?.textContent).toBe('?');
  });

  it('marks a unit nobody taught as a region instead of a zero', () => {
    const { container } = render(
      <DeliveredAbsorbed
        units={units}
        delivered={taught}
        absorbed={[
          { state: 'notDelivered', median: null, p25: null, p75: null },
          measured(60),
          measured(65),
          measured(70),
        ]}
        quality={{}}
      />,
    );

    // Scoped outside `<defs>`: the hatch pattern is built from a rect of the same fill.
    const regions = [...container.querySelectorAll('svg > rect')].filter(
      (rect) => rect.getAttribute('fill') === 'var(--ssz-bg-subtle)',
    );
    expect(regions).toHaveLength(1);
    expect(pathsOf(container, ABSORBED)).toHaveLength(1);
  });
});

describe('the delivered step', () => {
  it('leaves a gap where the timetable could not be asked, rather than dropping to zero', () => {
    const { container } = render(
      <DeliveredAbsorbed
        units={units}
        delivered={[{ value: 1 }, { value: null }, { value: 0.5 }, { value: 0 }]}
        absorbed={units.map(() => measured(60))}
        quality={{}}
      />,
    );

    const step = pathsOf(container, DELIVERED)[0]?.getAttribute('d') ?? '';
    // Two pen-downs: one before the gap and one after it.
    expect(step.split('M')).toHaveLength(3);
  });
});

describe('the quality strip', () => {
  it('hatches a unit with no attempts instead of colouring it at the bottom of the scale', () => {
    const { container } = render(
      <DeliveredAbsorbed
        units={units}
        delivered={taught}
        absorbed={units.map(() => measured(60))}
        quality={{ u1: 80, u2: null, u3: 0, u4: 50 }}
      />,
    );

    const strip = [...container.querySelectorAll('rect[rx="3"]')];
    expect(strip).toHaveLength(4);
    expect(strip[1]?.getAttribute('fill')).toBe('url(#paGap)');
    // A real zero is painted, at the bottom of the ramp — visibly not a hole.
    expect(strip[2]?.getAttribute('fill')).toContain('oklch');
  });
});
