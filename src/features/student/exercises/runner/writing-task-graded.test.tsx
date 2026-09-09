import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { RubricSnapshot } from '@/lib/shared-kernel/writing-task';

import { outcomeOf, WritingTaskGraded } from './writing-task-graded';

const SNAPSHOT: RubricSnapshot = {
  criteria: [
    {
      id: 'c1',
      name: 'Innhold',
      desc: 'Alle punktene er med',
      weight: 2,
      levels: ['Mangler mye', 'Delvis dekket', 'Nesten alt', 'Alle punktene er dekket'],
    },
    {
      id: 'c2',
      name: 'Språk',
      desc: 'Setningsbygning',
      weight: 1,
      levels: ['Svak', 'Ujevn', 'God', 'Sikker'],
    },
  ],
  passScore: 6,
};

function wrap(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('outcomeOf', () => {
  it('reads a failure through the author’s revision policy, not as a third verdict', () => {
    expect(outcomeOf(true, 'return')).toBe('passed');
    expect(outcomeOf(true, 'once')).toBe('passed');
    // The same failed submission, two labels: what separates them is whether the author
    // allowed a rewrite at all (BEHAVIOR §7).
    expect(outcomeOf(false, 'return')).toBe('rewrite');
    expect(outcomeOf(false, 'drafts')).toBe('rewrite');
    expect(outcomeOf(false, 'once')).toBe('failed');
  });

  it('treats an undecided attempt as not passed', () => {
    expect(outcomeOf(null, 'return')).toBe('rewrite');
  });
});

describe('WritingTaskGraded', () => {
  it('shows the score in rubric points, with the descriptor the teacher chose', () => {
    render(
      wrap(
        <WritingTaskGraded
          passed
          revision="return"
          showRubric="afterGraded"
          snapshot={SNAPSHOT}
          marks={{ c1: 3, c2: 2 }}
          score={89}
          comment="Bra jobbet, Anna!"
        />,
      ),
    );

    expect(screen.getByText('Passed')).toBeInTheDocument();
    // 3×2 + 2×1 out of 3×2 + 3×1. The percentage is what the SRS reads; it is not what
    // someone who wrote the text reads.
    expect(screen.getByText('8 / 9 points')).toBeInTheDocument();
    expect(screen.queryByText('89%')).not.toBeInTheDocument();

    expect(screen.getByText('Alle punktene er dekket')).toBeInTheDocument();
    expect(screen.getByText('God')).toBeInTheDocument();
    expect(screen.getByText('Bra jobbet, Anna!')).toBeInTheDocument();
  });

  it('falls back to the recorded percentage when there is no rubric behind the mark', () => {
    // An attempt graded before the rubric existed, or one graded per item.
    render(
      wrap(<WritingTaskGraded passed revision="return" showRubric="afterGraded" score={73} />),
    );

    expect(screen.getByText('73%')).toBeInTheDocument();
  });

  it('keeps the criteria to itself when the author said never', () => {
    render(
      wrap(
        <WritingTaskGraded
          passed={false}
          revision="return"
          showRubric="never"
          snapshot={SNAPSHOT}
          marks={{ c1: 1, c2: 1 }}
        />,
      ),
    );

    expect(screen.queryByText('Innhold')).not.toBeInTheDocument();
    // The score still travels: `never` hides the criteria, not the result.
    expect(screen.getByText('3 / 9 points')).toBeInTheDocument();
  });

  it('offers the rewrite once, and never after a pass or a final submission', async () => {
    const onRewrite = vi.fn();
    const { rerender } = render(
      wrap(
        <WritingTaskGraded
          passed={false}
          revision="return"
          showRubric="afterGraded"
          snapshot={SNAPSHOT}
          marks={{ c1: 1, c2: 1 }}
          onRewrite={onRewrite}
          nextAttemptNo={2}
        />,
      ),
    );

    expect(screen.getByText('Needs a rewrite')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Rewrite and hand in again/ }));
    expect(onRewrite).toHaveBeenCalledOnce();

    // `once`: the author allowed one submission, and a button promising a second reading
    // would promise something nobody agreed to.
    rerender(
      wrap(
        <WritingTaskGraded
          passed={false}
          revision="once"
          showRubric="afterGraded"
          snapshot={SNAPSHOT}
          marks={{ c1: 1, c2: 1 }}
          onRewrite={onRewrite}
        />,
      ),
    );
    expect(screen.getByText('Not passed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rewrite/ })).not.toBeInTheDocument();

    rerender(
      wrap(
        <WritingTaskGraded
          passed
          revision="return"
          showRubric="afterGraded"
          snapshot={SNAPSHOT}
          marks={{ c1: 3, c2: 3 }}
          onRewrite={onRewrite}
        />,
      ),
    );
    expect(screen.queryByRole('button', { name: /Rewrite/ })).not.toBeInTheDocument();
  });

  it('reads an unmarked criterion as zero rather than dropping the row', () => {
    render(
      wrap(
        <WritingTaskGraded
          passed={false}
          revision="return"
          showRubric="afterGraded"
          snapshot={SNAPSHOT}
          marks={{ c1: 2 }}
        />,
      ),
    );

    expect(screen.getByText('Språk')).toBeInTheDocument();
    expect(screen.getByText('Svak')).toBeInTheDocument();
    expect(screen.getByText('4 / 9 points')).toBeInTheDocument();
  });
});
