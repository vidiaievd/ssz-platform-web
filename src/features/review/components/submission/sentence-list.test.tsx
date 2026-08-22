import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewSubmission } from '@/features/review/types';
import type { TranslateItemDetail } from '@/features/content-authoring/types/review';

import { SentenceList } from './sentence-list';

const sentence = (over: Partial<TranslateItemDetail>): TranslateItemDetail => ({
  itemId: 's1',
  similarity: 0.8,
  routing: 'teacher',
  verdict: 'near',
  ref: 'Derfor trenger de mye mat.',
  submitted: 'Derfor de trenger mye mat.',
  tokens: [
    { t: 'same', w: 'Derfor', typo: null },
    { t: 'extra', w: 'de', typo: null },
    { t: 'missing', w: 'trenger', typo: null },
  ] as TranslateItemDetail['tokens'],
  missing: [],
  banned: [],
  ...over,
});

const SUBMISSION = (over: Partial<ReviewSubmission> = {}): ReviewSubmission =>
  ({
    id: 'att-1',
    status: 'pending',
    student: { id: 's1', name: 'Anna', groupName: null },
    exercise: {
      id: 'ex-1',
      title: 'Perfektum',
      type: 'translate_to_target',
      path: { course: null, lesson: null },
      available: true,
      contentLang: 'nb',
    },
    submittedAt: null,
    ageHours: 1,
    slaHours: 24,
    overdue: false,
    attemptNo: 1,
    previous: null,
    decision: null,
    lock: null,
    details: {
      totalItems: 2,
      routedItems: 1,
      passedItems: 1,
      items: [
        sentence({
          itemId: 'closed',
          routing: 'pass',
          verdict: 'exact',
          submitted: 'Jeg er her.',
          ref: 'Jeg er her.',
        }),
        sentence({
          itemId: 'open',
          prompt: 'Поэтому им нужно много еды.',
          note: 'Inversjon etter Derfor',
        }),
      ],
    },
    prompts: {
      open: { prompt: 'Поэтому им нужно много еды.', teacherNote: 'Inversjon etter Derfor' },
    },
    text: null,
    rubric: null,
    rubricMarks: null,
    submittedAnswer: {},
    canDecide: true,
    ...over,
  }) as ReviewSubmission;

/** The panel owns the comments; this stands in for it. */
function Harness({ submission }: { submission: ReviewSubmission }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, number>>({});
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SentenceList
        submission={submission}
        marks={marks}
        onMark={(criterionId, mark) => setMarks((current) => ({ ...current, [criterionId]: mark }))}
        editable
        comments={comments}
        onComment={(itemId, value) =>
          setComments((current) => {
            if (value === undefined) {
              const { [itemId]: _gone, ...rest } = current;
              return rest;
            }
            return { ...current, [itemId]: value };
          })
        }
      />
    </NextIntlClientProvider>
  );
}

const renderList = (submission = SUBMISSION()) => render(<Harness submission={submission} />);

describe('SentenceList', () => {
  it('says how much the machine closed before the reading starts', () => {
    renderList();
    expect(screen.getByText('1 of 2 closed by the machine, word for word')).toBeInTheDocument();
  });

  it('folds what the machine closed and opens it on request', async () => {
    renderList();

    // Collapsed: the answer on one line, no diff under it.
    expect(screen.getByText('Jeg er her.')).toBeInTheDocument();
    expect(screen.queryByText('closest accepted answer: Jeg er her.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Jeg er her/ }));
    expect(screen.getByText('closest accepted answer: Jeg er her.')).toBeInTheDocument();
  });

  it('puts the question and the author’s aside beside the answer', () => {
    renderList();
    expect(screen.getByText('Поэтому им нужно много еды.')).toBeInTheDocument();
    expect(screen.getByText('Inversjon etter Derfor')).toBeInTheDocument();
  });

  it('marks the diff by form as well as by colour (criterion 12)', () => {
    const { container } = renderList();

    const extra = container.querySelector('.line-through');
    const missing = container.querySelector('.font-bold');
    expect(extra?.textContent).toContain('de');
    expect(missing?.textContent).toContain('trenger');
  });

  it('keeps a comment on one sentence, and lets it be taken off again', async () => {
    renderList();

    await userEvent.click(screen.getByRole('button', { name: 'Comment on this sentence' }));
    await userEvent.type(screen.getByRole('textbox'), 'Se på ordstillingen.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Se på ordstillingen.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Se på ordstillingen.')).toBeNull();
  });

  it('opens a writing task as prose, with no empty slots for a diff (criterion 22)', () => {
    renderList(
      SUBMISSION({
        exercise: { ...SUBMISSION().exercise, type: 'writing_task' },
        details: null,
        text: 'Jeg heter Anna og jeg bor i Oslo.',
      }),
    );

    expect(screen.getByText('The work · 8 words')).toBeInTheDocument();
    expect(screen.getByText('Jeg heter Anna og jeg bor i Oslo.')).toBeInTheDocument();
    expect(screen.queryByText(/closed by the machine/)).toBeNull();
  });

  it('shows the answer as handed in when no breakdown could be built', () => {
    renderList(
      SUBMISSION({ details: null, submittedAnswer: { items: { s1: 'Derfor de trenger.' } } }),
    );
    expect(screen.getByText('Derfor de trenger.')).toBeInTheDocument();
  });
});
