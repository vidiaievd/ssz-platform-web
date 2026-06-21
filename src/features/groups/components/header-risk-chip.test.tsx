import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { HeaderRiskChip } from './header-risk-chip';
import type { Alert } from '@/features/dashboard/types';

const dangerAlert: Alert = { type: 'no-primary', severity: 'danger', label: 'No primary teacher' };
const warnAlert: Alert = { type: 'overload', severity: 'warn', label: 'Teacher overloaded' };
const otherWarnAlert: Alert = { type: 'conflict', severity: 'warn', label: 'Time clash' };

describe('HeaderRiskChip', () => {
  it('renders nothing when there are no alerts', () => {
    const { container } = render(<HeaderRiskChip alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('picks the danger alert over warn alerts', () => {
    render(<HeaderRiskChip alerts={[warnAlert, dangerAlert]} />);
    expect(screen.getByText('No teacher')).toBeInTheDocument();
    expect(screen.queryByText('Overloaded')).not.toBeInTheDocument();
  });

  it('falls back to the first warn alert when no danger alert exists', () => {
    render(<HeaderRiskChip alerts={[warnAlert, otherWarnAlert]} />);
    expect(screen.getByText('Overloaded')).toBeInTheDocument();
  });
});
