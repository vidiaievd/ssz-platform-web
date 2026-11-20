import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { HistorySection } from './history-section';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const history = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('@/features/student/api/use-my-history', () => ({ useMyHistory: () => ({ data: history.data }) }));

const item = (id: string, course: object | null) => ({ containerId: id, completedAt: '2026-11-20T10:00:00Z', course });

describe('HistorySection', () => {
  it('draws nothing without finished courses, or when the grid already shows them', () => {
    history.data = [item('a', { title: 'Norsk B1', level: 'B1', targetLanguage: 'no' })];
    const { container } = renderWithProviders(<HistorySection shownIds={new Set(['a'])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links a readable course and only names one that is gone', () => {
    history.data = [
      item('a', { title: 'Norsk B1', level: 'B1', targetLanguage: 'no' }),
      item('b', null),
    ];
    renderWithProviders(<HistorySection shownIds={new Set()} />);
    expect(screen.getByRole('link', { name: /Norsk B1/ })).toHaveAttribute('href', expect.stringContaining('/student/courses/a'));
    expect(screen.getByTestId('history-unavailable')).toHaveTextContent('Course unavailable');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
