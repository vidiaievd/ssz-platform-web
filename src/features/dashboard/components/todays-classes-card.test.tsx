import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import type { TodaysClass } from '../types';

import { TodaysClassesCard } from './todays-classes-card';

function cls(over: Partial<TodaysClass> = {}): TodaysClass {
  return {
    id: 's1',
    time: '18:00',
    name: 'Norsk A2 · kveld',
    room: '',
    mode: 'online',
    students: 7,
    cap: 12,
    status: 'upcoming',
    ...over,
  };
}

describe('TodaysClassesCard', () => {
  it('draws nothing when scheduling could not be read', () => {
    const { container } = renderWithProviders(
      <TodaysClassesCard todaysClasses={{ status: 'unavailable' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says the day is clear when nothing is on', () => {
    renderWithProviders(<TodaysClassesCard todaysClasses={{ status: 'empty' }} />);
    expect(screen.getByText('No classes today')).toBeInTheDocument();
  });

  it('lists a class with its time, group and head count', () => {
    renderWithProviders(<TodaysClassesCard todaysClasses={{ status: 'ok', data: [cls()] }} />);

    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('Norsk A2 · kveld')).toBeInTheDocument();
    expect(screen.getByText('7/12')).toBeInTheDocument();
  });

  it('names a class of an unknown group plainly and counts it without a capacity', () => {
    renderWithProviders(
      <TodaysClassesCard todaysClasses={{ status: 'ok', data: [cls({ name: null, cap: null, students: 0 })] }} />,
    );

    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByLabelText('under-enrolled')).not.toBeInTheDocument();
  });

  it('shows the room of a class held in person', () => {
    renderWithProviders(
      <TodaysClassesCard todaysClasses={{ status: 'ok', data: [cls({ mode: 'in-person', room: '204' })] }} />,
    );
    expect(screen.getByText('204')).toBeInTheDocument();
  });
});
