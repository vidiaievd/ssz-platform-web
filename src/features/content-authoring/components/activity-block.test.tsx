import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { ActivityEntry, ContainerActivity } from '../types';

const useContainerActivity = vi.fn();
vi.mock('../api/use-container-activity', () => ({
  useContainerActivity: (...args: unknown[]) => useContainerActivity(...args),
}));

const { ActivityBlock } = await import('./activity-block');

const ENTRY: ActivityEntry = {
  id: 'entry-1',
  entityType: 'EXERCISE',
  entityId: 'exercise-1',
  entityTitle: 'Gap-Fill',
  action: 'updated',
  actorUserId: 'user-1',
  actor: { userId: 'user-1', displayName: 'Dmytro V.' },
  changedFields: ['content'],
  occurredAt: new Date(Date.now() - 60_000).toISOString(),
};

function renderBlock(state: { data?: ContainerActivity; isLoading?: boolean; isError?: boolean }) {
  useContainerActivity.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  });

  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ActivityBlock containerId="course-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('ActivityBlock', () => {
  beforeEach(() => useContainerActivity.mockReset());

  it('reports what changed, to what, by whom', () => {
    renderBlock({ data: { entries: [ENTRY], hasMore: false } });

    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.getByText('Gap-Fill')).toBeInTheDocument();
    expect(screen.getByText('Dmytro V.')).toBeInTheDocument();
  });

  it('names the fields an edit touched, not their storage keys', () => {
    renderBlock({ data: { entries: [ENTRY], hasMore: false } });

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByText('expectedAnswers')).not.toBeInTheDocument();
  });

  it('shows an unresolved actor as someone rather than a uuid', () => {
    renderBlock({ data: { entries: [{ ...ENTRY, actor: null }], hasMore: false } });

    expect(screen.getByText('Someone')).toBeInTheDocument();
    expect(screen.queryByText('user-1')).not.toBeInTheDocument();
  });

  it('shows an unknown action verbatim instead of breaking', () => {
    // `action` is open-ended by design upstream: a new one reaching an old
    // client should read oddly, not blank the panel.
    renderBlock({
      data: { entries: [{ ...ENTRY, action: 'teleported' }], hasMore: false },
    });

    expect(screen.getByText('teleported')).toBeInTheDocument();
  });

  it('carries the exact time even though it reads as relative', () => {
    renderBlock({ data: { entries: [ENTRY], hasMore: false } });

    const time = screen.getByText(/minute ago/);
    expect(time).toHaveAttribute('dateTime', ENTRY.occurredAt);
    expect(time).toHaveAttribute('title', expect.stringContaining('20'));
  });

  it('says when it is showing only part of the history', () => {
    renderBlock({ data: { entries: [ENTRY], hasMore: true } });

    expect(screen.getByText('Only the most recent changes are shown.')).toBeInTheDocument();
  });

  it('distinguishes a failed load from an empty history', () => {
    renderBlock({ isError: true });

    expect(screen.getByText('Could not load the history.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing has been changed here yet.')).not.toBeInTheDocument();
  });

  it('says so when nothing has happened', () => {
    renderBlock({ data: { entries: [], hasMore: false } });

    expect(screen.getByText('Nothing has been changed here yet.')).toBeInTheDocument();
  });
});
