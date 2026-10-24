import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

// The localised `Link` needs the app's routing context; here only the href it builds is
// under test, so it stands in as the anchor it renders to.
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MyRow } from './my-row';
import type { MySubmission } from '../types';

function submission(overrides: Partial<MySubmission> = {}): MySubmission {
  return {
    id: 'att-1',
    exerciseId: 'ex-1',
    exerciseType: 'translate_to_target',
    targetLanguage: 'no',
    exerciseTitle: 'Familien',
    course: 'Ny i Norge — A2',
    lesson: 'Leksjon 19',
    containerId: 'course-1',
    submittedAt: new Date().toISOString(),
    status: 'returned',
    attemptNo: 2,
    expectedResponseBy: null,
    decision: {
      verdict: 'returned',
      by: 'teacher',
      teacherId: 'teacher-1',
      teacherName: 'Kari Nordmann',
      at: new Date().toISOString(),
      comment: 'Se på perfektum.',
    },
    reader: 'teacher',
    canResubmit: true,
    ...overrides,
  };
}

function renderRow(value: MySubmission) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MyRow submission={value} open onToggle={() => {}} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('MyRow — the way back into returned work (47.3)', () => {
  it('sends a set of sentences back to the runner it was typed in, with the verdict named', () => {
    renderRow(submission());

    expect(screen.getByRole('link', { name: 'Do it again' })).toHaveAttribute(
      'href',
      '/student/exercises/ex-1?from=submission&attempt=att-1',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('rewrites an essay in the card, under the comment it came back with', () => {
    renderRow(submission({ exerciseType: 'writing_task' }));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Se på perfektum.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Do it again' })).not.toBeInTheDocument();
  });

  /**
   * A resubmit always resumes the newest returned attempt at an exercise, so a superseded
   * row must not offer a button that would quietly act on a different row.
   */
  it('offers no second go on a returned row a later attempt already replaced', () => {
    renderRow(submission({ canResubmit: false }));

    expect(screen.queryByRole('link', { name: 'Do it again' })).not.toBeInTheDocument();
    expect(screen.getByText(/newest attempt is the one that counts/i)).toBeInTheDocument();
  });

  it('leaves marked work alone — there is nothing to hand in again', () => {
    renderRow(
      submission({
        status: 'approved',
        canResubmit: false,
        decision: {
          verdict: 'approved',
          by: 'teacher',
          teacherId: 'teacher-1',
          teacherName: 'Kari Nordmann',
          at: new Date().toISOString(),
          comment: null,
        },
      }),
    );

    expect(screen.queryByRole('link', { name: 'Do it again' })).not.toBeInTheDocument();
    expect(screen.getByText('Marked as correct, with nothing to add.')).toBeInTheDocument();
  });
});

describe('MyRow — a model’s verdict (plan 79, 2.3c)', () => {
  const aiReturned = () =>
    submission({
      reader: 'ai',
      decision: {
        verdict: 'returned',
        by: 'ai',
        teacherId: null,
        teacherName: null,
        at: new Date().toISOString(),
        comment: 'Se på verbet.',
      },
    });

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              outcome: 'returned',
              items: [],
              summary: 'Se på verbet.',
              marks: null,
              reviewedAt: new Date().toISOString(),
              disputedAt: null,
            }),
            { status: 200 },
          ),
        ),
      ),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('signs the row as AI and shows the review under its label, the summary once', async () => {
    renderRow(aiReturned());

    expect(screen.getByText(/^Checked by AI ·/)).toBeInTheDocument();
    expect(screen.getByText('Checked by AI, not a teacher')).toBeInTheDocument();
    expect(await screen.findByText('Se på verbet.')).toBeInTheDocument();
    expect(screen.getAllByText('Se på verbet.')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'This review is wrong' })).toBeInTheDocument();
  });

  it('still offers the way back into work a model sent back', () => {
    renderRow(aiReturned());

    expect(screen.getByRole('link', { name: 'Do it again' })).toBeInTheDocument();
  });

  it('does not promise a teacher’s queue for work the model is still reading', () => {
    renderRow(submission({ status: 'pending', reader: 'ai', decision: null, canResubmit: false }));

    expect(screen.getByText('AI is reviewing — usually under a minute')).toBeInTheDocument();
    expect(screen.queryByText(/teacher.s queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Checked by AI, not a teacher')).not.toBeInTheDocument();
  });
});
