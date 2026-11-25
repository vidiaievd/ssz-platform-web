import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { WaitingWork } from '@/lib/dashboard/queries';

import { TeacherQueueCard } from './teacher-queue-card';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const NOW = new Date('2026-11-25T12:00:00.000Z');

function work(over: Partial<WaitingWork> = {}): WaitingWork {
  return {
    id: 'a1',
    who: 'Anna Kowalska',
    what: 'Skriv om helgen',
    submittedAt: '2026-11-25T09:00:00.000Z',
    kind: 'pen',
    ...over,
  };
}

describe('TeacherQueueCard', () => {
  // It used to be drawn with `items={[]}` whatever waited: a teacher always read «nothing to grade».
  it('lists the waiting work with who, what and how long ago, and leads to the review screen', () => {
    renderWithProviders(
      <TeacherQueueCard
        work={{ status: 'ok', data: { pending: 2, items: [work(), work({ id: 'a2', who: 'Ola', kind: 'mic', what: null })] } }}
        href="/w/nordick/review"
        now={NOW}
      />,
    );

    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
    expect(screen.getByText(/Skriv om helgen · 3 hours ago/)).toBeInTheDocument();
    expect(screen.getByText('Ola')).toBeInTheDocument();
    expect(screen.getByLabelText('speaking submission')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', expect.stringContaining('/w/nordick/review'));
    expect(screen.queryByText(/more submission/)).not.toBeInTheDocument();
  });

  it('tells the owner the card is the whole school', () => {
    renderWithProviders(
      <TeacherQueueCard work={{ status: 'ok', data: { pending: 1, items: [work()] } }} href="/r" whose="school" now={NOW} />,
    );
    expect(screen.getByText('Student submissions across the school awaiting review')).toBeInTheDocument();
  });

  it('counts what waits beyond the rows it shows', () => {
    renderWithProviders(
      <TeacherQueueCard work={{ status: 'ok', data: { pending: 7, items: [work()] } }} href="/r" now={NOW} />,
    );
    expect(screen.getByText('And 6 more submissions')).toBeInTheDocument();
  });

  it('names a learner the directory does not know yet', () => {
    renderWithProviders(
      <TeacherQueueCard work={{ status: 'ok', data: { pending: 1, items: [work({ who: null })] } }} href="/r" now={NOW} />,
    );
    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it('says there is nothing to grade when the queue is empty', () => {
    renderWithProviders(<TeacherQueueCard work={{ status: 'ok', data: { pending: 0, items: [] } }} href="/r" />);
    expect(screen.getByText('Nothing to grade yet')).toBeInTheDocument();
  });

  it('says the data is unavailable when the queue could not be read', () => {
    renderWithProviders(<TeacherQueueCard work={{ status: 'unavailable' }} href="/r" />);
    expect(screen.queryByText('Nothing to grade yet')).not.toBeInTheDocument();
    expect(screen.getByText('Grade queue')).toBeInTheDocument();
  });
});
