import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MasteryCell, type MasteryCellData, type MasteryCellLabels } from './mastery-cell';

const labels: MasteryCellLabels = {
  noItems: 'no items',
  notStarted: 'not started',
  stable: (days) => `${days}d stable`,
  shortfall: (sample, threshold) => `${sample}/${threshold}`,
};

const cell = (over: Partial<MasteryCellData> = {}): MasteryCellData => ({
  state: 'ok',
  ewma: 72,
  meanStability: 11.43,
  weightedSample: 14,
  ...over,
});

const draw = (data: MasteryCellData | undefined) =>
  render(<MasteryCell cell={data} minWeightedSample={8} labels={labels} />);

describe('MasteryCell', () => {
  it('prints the score with the stability under it', () => {
    draw(cell());

    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('11.4d stable')).toBeInTheDocument();
  });

  it('says a measured zero rather than leaving it blank', () => {
    draw(cell({ state: 'low', ewma: 0, meanStability: null }));

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('never prints a percentage for a cell that was only thinly practised', () => {
    draw(cell({ state: 'insufficient', ewma: null, weightedSample: 3.25 }));

    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('3.3/8')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('tells "the learner has not started" apart from "the course has none of this"', () => {
    draw(cell({ state: 'notStarted', ewma: null }));
    expect(screen.getByText('not started')).toBeInTheDocument();

    draw(cell({ state: 'noContent', ewma: null }));
    expect(screen.getByText('no items')).toBeInTheDocument();
  });

  // A pair the service did not send at all is the same claim as a pair with no items:
  // nothing to do here. What it must not become is a scored cell.
  it('treats a missing cell as "no items", not as a zero', () => {
    draw(undefined);

    expect(screen.getByText('no items')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
