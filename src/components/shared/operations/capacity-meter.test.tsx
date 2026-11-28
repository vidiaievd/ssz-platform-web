import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CapacityMeter } from './capacity-meter';

describe('CapacityMeter', () => {
  it('shows count against the ceiling, with a bar', () => {
    render(<CapacityMeter count={8} min={0} max={12} />);
    expect(screen.getByText('/ 12')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '12');
  });

  it('flags a count above the ceiling', () => {
    render(<CapacityMeter count={13} min={0} max={12} />);
    expect(screen.getByText('over')).toBeInTheDocument();
  });

  // OQ-111: a group without capacityMax read «8/999».
  it('shows the count alone and no bar for a group without a ceiling', () => {
    render(<CapacityMeter count={8} min={0} max={null} projected={40} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('over')).not.toBeInTheDocument();
  });
});
