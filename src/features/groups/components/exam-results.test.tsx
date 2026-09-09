import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { ExamResults } from './exam-results';
import type { RosterStudent, SessionScore } from '../types';

function student(userId: string, name: string): RosterStudent {
  return {
    userId,
    name,
    email: `${userId}@example.com`,
    level: 'A2',
    status: 'active',
    progress: 0,
    hasClash: false,
  };
}

const ROSTER = [student('a', 'Ada Lovelace'), student('b', 'Bo Nilsen'), student('c', 'Cai Wu')];

function render(scores: SessionScore[], onChange = () => {}) {
  return renderWithProviders(
    <ExamResults roster={ROSTER} scores={scores} passMark={60} onChange={onChange} />,
  );
}

describe('ExamResults', () => {
  it('leaves an ungraded student out of both the average and the pass count', () => {
    render([
      { studentId: 'a', score: 90 },
      { studentId: 'b', score: 50 },
      { studentId: 'c', score: null },
    ]);

    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('has no average at all before anything is entered', () => {
    render([]);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('marks each graded student pass or fail against the school threshold', () => {
    render([
      { studentId: 'a', score: 60 },
      { studentId: 'b', score: 59 },
    ]);

    expect(screen.getByText('pass')).toBeInTheDocument();
    expect(screen.getByText('fail')).toBeInTheDocument();
  });

  it('clamps a score to 0..100 instead of storing what was typed', () => {
    const onChange = vi.fn();
    render([], onChange);

    // One change with the whole value: the parent here holds the marks static,
    // so typing digit by digit would only ever report the last keystroke.
    fireEvent.change(screen.getByLabelText('Score for Ada Lovelace'), {
      target: { value: '120' },
    });
    expect(onChange).toHaveBeenLastCalledWith([{ studentId: 'a', score: 100 }]);
  });

  it('reads an emptied field as ungraded, not as a zero', async () => {
    const onChange = vi.fn();
    render([{ studentId: 'a', score: 70 }], onChange);

    await userEvent.clear(screen.getByLabelText('Score for Ada Lovelace'));
    expect(onChange).toHaveBeenLastCalledWith([{ studentId: 'a', score: null }]);
  });
});
