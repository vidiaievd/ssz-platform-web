import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PositionScale } from './position-scale';

describe('PositionScale', () => {
  it('reads out both numbers for somebody who cannot see the line', () => {
    render(<PositionScale own={71} median={58} medianLabel="median" ownLabel="This student" />);

    expect(screen.getByRole('img')).toHaveAccessibleName('This student 71% · median 58%');
  });

  // A percentage arriving outside 0..100 is a bug upstream, but a dot rendered outside
  // the track is a wrong picture rather than a missing one.
  it('keeps the dot on the track whatever it is given', () => {
    const { container } = render(
      <PositionScale own={140} median={-10} medianLabel="median" ownLabel="This student" />,
    );

    const positions = [...container.querySelectorAll<HTMLElement>('[style*="left"]')].map(
      (node) => node.style.left,
    );

    expect(positions).not.toContain('140%');
    expect(positions).not.toContain('-10%');
    expect(positions).toContain('100%');
    expect(positions).toContain('0%');
  });
});
