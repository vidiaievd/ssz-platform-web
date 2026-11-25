import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import type { ActivityItem } from '../types';

import { ActivityFeed } from './activity-feed';

function item(over: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'a1',
    who: 'student2',
    what: 'enrolled in',
    eventType: 'learning.enrollment.created',
    target: 'Norsk uttale',
    time: new Date().toISOString(),
    iconKey: 'user',
    tone: 'primary',
    tag: 'people',
    ...over,
  };
}

describe('ActivityFeed', () => {
  it('names the course an enrolment went to', () => {
    renderWithProviders(<ActivityFeed activity={{ status: 'ok', data: [item()] }} />);
    expect(screen.getByText('enrolled in')).toBeInTheDocument();
    expect(screen.getByText('Norsk uttale')).toBeInTheDocument();
  });

  it('says "a course" instead of leaving the sentence hanging when the course has no title', () => {
    renderWithProviders(<ActivityFeed activity={{ status: 'ok', data: [item({ target: '' })] }} />);
    expect(screen.getByText('enrolled in a course')).toBeInTheDocument();
  });
});
