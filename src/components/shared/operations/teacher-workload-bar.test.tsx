import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { TeacherWorkloadBar } from './teacher-workload-bar';
import type { TeacherLoad } from '@/features/dashboard/types';

const teacher = (over: Partial<TeacherLoad> = {}): TeacherLoad => ({
  id: 't1', name: 'Kari', hours: 10.5, max: 20, pct: 53, overloaded: false, groups: 2, conflicts: 0, ...over,
});

describe('TeacherWorkloadBar', () => {
  it('words the hours through messages, one decimal', () => {
    renderWithProviders(<ul><TeacherWorkloadBar teacher={teacher({ hours: 0 })} /></ul>);
    expect(screen.getByText('0.0/20h')).toBeInTheDocument();
  });

  it('names the overload and the clashes in the reader language', () => {
    renderWithProviders(
      <ul><TeacherWorkloadBar teacher={teacher({ hours: 22.5, pct: 113, overloaded: true, conflicts: 2 })} /></ul>,
    );
    expect(screen.getByText('22.5/20h')).toBeInTheDocument();
    expect(screen.getByText('+2.5h over')).toBeInTheDocument();
    expect(screen.getByText('2 clashes')).toBeInTheDocument();
  });
});
