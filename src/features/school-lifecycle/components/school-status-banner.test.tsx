import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { MaintenanceBadge } from './maintenance-badge';
import { SchoolStatusBanner } from './school-status-banner';

describe('SchoolStatusBanner', () => {
  it('draws nothing for an active school or an unknown status', () => {
    const { container, rerender } = renderWithProviders(<SchoolStatusBanner audience="staff" status="active" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SchoolStatusBanner audience="student" status={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tells staff a suspended school is blocked until a date', () => {
    renderWithProviders(
      <SchoolStatusBanner audience="staff" status="suspended" closesAt="2099-01-15T00:00:00Z" />,
    );
    const banner = screen.getByTestId('school-status-banner');
    expect(banner).toHaveAttribute('data-status', 'suspended');
    expect(banner).toHaveTextContent('This school is blocked');
    expect(banner).toHaveTextContent(/Blocked until .*2099/);
    expect(banner).toHaveTextContent('contact platform support');
  });

  it('falls back to a dateless sentence when the service sent no date', () => {
    renderWithProviders(<SchoolStatusBanner audience="staff" status="suspended" closesAt={null} />);
    expect(screen.getByTestId('school-status-banner')).toHaveTextContent('The school is read only.');
  });

  it('tells staff a closed school is in the archive until the purge date', () => {
    renderWithProviders(<SchoolStatusBanner audience="staff" status="closed" purgeAt="2099-06-01T00:00:00Z" />);
    expect(screen.getByTestId('school-status-banner')).toHaveTextContent(/In the archive until .*2099/);
  });

  it('tells a learner their history stays and work is paused', () => {
    renderWithProviders(<SchoolStatusBanner audience="student" status="suspended" />);
    expect(screen.getByTestId('school-status-banner')).toHaveTextContent('starting and handing in work is paused');
    renderWithProviders(<SchoolStatusBanner audience="student" status="closed" />);
    expect(screen.getAllByTestId('school-status-banner')[1]).toHaveTextContent('Your own history stays with you');
  });
});

describe('MaintenanceBadge', () => {
  it('marks unmaintained and obsolete courses only', () => {
    const { container, rerender } = renderWithProviders(<MaintenanceBadge status="maintained" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<MaintenanceBadge status={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<MaintenanceBadge status="unmaintained" />);
    expect(screen.getByText('No longer maintained')).toBeInTheDocument();
    rerender(<MaintenanceBadge status="obsolete" />);
    expect(screen.getByText('Outdated')).toBeInTheDocument();
  });
});
