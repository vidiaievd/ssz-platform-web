import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { GroupHealthLine } from './group-health-line';
import type { Alert } from '@/features/dashboard/types';

const dangerAlert: Alert = { type: 'no-primary', severity: 'danger', label: 'No primary teacher' };
const warnAlert: Alert = { type: 'overload', severity: 'warn', label: 'Teacher overloaded' };

describe('GroupHealthLine', () => {
  it('shows "Not ready to run" when a danger alert is present', () => {
    renderWithProviders(<GroupHealthLine alerts={[dangerAlert]} status="active" />);
    expect(screen.getByText(/Not ready to run/)).toBeInTheDocument();
  });

  it('shows "Ready to run" when there are no danger alerts', () => {
    renderWithProviders(<GroupHealthLine alerts={[warnAlert]} status="active" />);
    expect(screen.getByText(/Ready to run/)).toBeInTheDocument();
  });

  it('shows "Ready to run" when there are no alerts at all', () => {
    renderWithProviders(<GroupHealthLine alerts={[]} status="active" />);
    expect(screen.getByText(/Ready to run/)).toBeInTheDocument();
  });

  it('shows "Status unknown" when degraded, regardless of alerts', () => {
    renderWithProviders(<GroupHealthLine alerts={[dangerAlert]} status="active" degraded />);
    expect(screen.getByText(/Status unknown/)).toBeInTheDocument();
    expect(screen.queryByText('Not ready to run')).not.toBeInTheDocument();
  });
});
