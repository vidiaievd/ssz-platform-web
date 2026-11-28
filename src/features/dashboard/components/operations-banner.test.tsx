import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { OperationsBanner } from './operations-banner';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe('OperationsBanner', () => {
  it('is silent without problems', () => {
    const { container } = renderWithProviders(<OperationsBanner conflictCount={0} noTeacherCount={0} workspaceId="w" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('agrees the verb with one group', () => {
    renderWithProviders(<OperationsBanner conflictCount={0} noTeacherCount={1} workspaceId="w" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/1 group with no teacher blocks lessons/);
  });

  it('takes the plural for two kinds of problem', () => {
    renderWithProviders(<OperationsBanner conflictCount={1} noTeacherCount={1} workspaceId="w" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/ block lessons/);
  });
});
