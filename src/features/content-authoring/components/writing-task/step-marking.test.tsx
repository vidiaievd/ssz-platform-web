import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, rubricMax, type WritingTask } from '@/lib/shared-kernel/writing-task';

import { StepMarking } from './step-marking';

function doc(overrides: Partial<WritingTask> = {}): WritingTask {
  const content = emptyContent();
  return {
    id: 'ex-1',
    type: 'writing_task',
    moduleId: 'module-1',
    title: '',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...content,
    prompt: 'Du har nettopp flyttet til en ny by.',
    ...overrides,
  };
}

function Harness({
  initial,
  onChange,
}: {
  initial: WritingTask;
  onChange?: (next: WritingTask) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepMarking
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: WritingTask = doc(), onChange?: (next: WritingTask) => void) {
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup() };
}

/** The default rubric is 4 criteria, one of weight 2 — 15 points. */
const MAX = rubricMax(emptyContent());

describe('an empty rubric', () => {
  it('says so where the criteria would be', () => {
    // Nothing else on the step can carry this one: with no criteria there is no card to
    // mark red, and the author is left with a red dot over a screen that looks fine.
    renderStep(doc({ rubric: [] }));

    expect(
      screen.getByText('The rubric is empty — there is nothing for a teacher to mark against.'),
    ).toBeInTheDocument();
  });
});

describe('the pass mark', () => {
  it('states the threshold against the ceiling the rubric actually awards', () => {
    renderStep();

    expect(screen.getByText(`${MAX} points`)).toBeInTheDocument();
    expect(screen.getByText(`A pass starts at 8 of ${MAX} points.`)).toBeInTheDocument();
  });

  it('says a threshold above the ceiling is unreachable, and marks the field', () => {
    renderStep(doc({ settings: { ...doc().settings, passScore: 40 } }));

    expect(screen.getByLabelText('Pass from')).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText(`40 points cannot be reached: this rubric awards ${MAX} at most.`),
    ).toBeInTheDocument();
  });

  // Zero is not "no threshold" here — it is a task that passes itself.
  it('will not take a pass mark of zero', () => {
    const onChange = vi.fn();
    renderStep(doc(), onChange);

    fireEvent.change(screen.getByLabelText('Pass from'), { target: { value: '0' } });

    expect((onChange.mock.calls.at(-1)![0] as WritingTask).settings.passScore).toBe(1);
  });

  it('follows the ceiling down when a criterion is removed', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc({ settings: { ...doc().settings, passScore: 15 } }), onChange);

    await user.click(screen.getByRole('button', { name: 'Remove criterion 1' }));

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect(next.settings.passScore).toBe(rubricMax(next));
  });
});

describe('a criterion', () => {
  it('shows the top and bottom descriptor while collapsed', () => {
    renderStep();

    expect(
      screen.getByText(/^3 — Alle punktene er dekket og utdypet · 0 — Svarer ikke på oppgaven$/),
    ).toBeInTheDocument();
  });

  it('lists the four descriptors top first once expanded', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Level descriptors for criterion 1' }));

    expect(screen.getByLabelText('Criterion 1, level 3')).toHaveValue(
      'Alle punktene er dekket og utdypet',
    );
    expect(screen.getByLabelText('Criterion 1, level 0')).toHaveValue('Svarer ikke på oppgaven');
  });

  it('marks an unnamed criterion invalid — it is a blocker, not a blank', () => {
    const base = doc();
    const rubric = base.rubric.map((c, i) => (i === 0 ? { ...c, name: '  ' } : c));
    renderStep(doc({ rubric }));

    expect(screen.getByLabelText('Name of criterion 1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('doubles its weight, which doubles the ceiling it contributes', async () => {
    const onChange = vi.fn();
    const base = doc();
    const rubric = base.rubric.map((c) => ({ ...c, weight: 1 as const }));
    const { user } = renderStep(doc({ rubric }), onChange);

    const weight = screen.getByRole('radiogroup', { name: 'Weight of criterion 1' });
    await user.click(within(weight).getByRole('radio', { name: '×2' }));

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect(rubricMax(next)).toBe(rubricMax(doc({ rubric })) + 3);
  });

  it('cannot be deleted down past two', () => {
    const base = doc();
    renderStep(doc({ rubric: base.rubric.slice(0, 2) }));

    expect(screen.getByRole('button', { name: 'Remove criterion 1' })).toBeDisabled();
  });

  it('stops being addable at six', () => {
    const base = doc();
    const rubric = [
      ...base.rubric,
      ...base.rubric.slice(0, 2).map((c) => ({ ...c, id: `${c.id}-x` })),
    ];
    renderStep(doc({ rubric }));

    expect(screen.getByRole('button', { name: 'Add criterion' })).toBeDisabled();
  });

  // Plan 50 §3.4: a criterion the author invents arrives with no metric, and without
  // this control it would never get one.
  it('lets the author say what a new criterion should be suggested from', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc(), onChange);

    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.click(screen.getByRole('button', { name: 'Level descriptors for criterion 5' }));

    expect(
      screen.getByText('No suggestion: the teacher starts this criterion from a blank mark.'),
    ).toBeInTheDocument();

    const control = screen.getByRole('radiogroup', { name: 'Mark suggestion for criterion 5' });
    await user.click(within(control).getByRole('radio', { name: 'Paragraphs' }));

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect(next.rubric[4]!.metric).toBe('paragraphs');
  });
});

describe('what the student sees', () => {
  it('warns that always-on descriptors are read by the student while writing', async () => {
    const { user } = renderStep();

    expect(
      screen.queryByText(/write them as something a student can aim at/),
    ).not.toBeInTheDocument();

    const control = screen.getByRole('radiogroup', { name: 'Show the rubric to the student' });
    await user.click(within(control).getByRole('radio', { name: 'Always' }));

    expect(screen.getByText(/write them as something a student can aim at/)).toBeInTheDocument();
  });

  // The kernel files a missing example under step 3; the field is on step 1.
  it('says where the missing example answer is written', () => {
    renderStep();

    expect(screen.getByText(/It is written in step 1, under the points./)).toBeInTheDocument();
  });

  it('says nothing about the example once there is one', () => {
    renderStep(doc({ model: 'Hei Anna, jeg har nettopp flyttet til Bergen.' }));

    expect(screen.queryByText(/It is written in step 1/)).not.toBeInTheDocument();
  });

  it('says nothing about the example when it would never be shown anyway', () => {
    renderStep(doc({ settings: { ...doc().settings, showModel: 'never' } }));

    expect(screen.queryByText(/It is written in step 1/)).not.toBeInTheDocument();
  });
});

describe('the tester', () => {
  it('shows nothing until there is a text to look at', () => {
    renderStep();

    expect(screen.queryByText(/words ·/)).not.toBeInTheDocument();
  });

  it('reports the facts and the suggested total for a pasted text', async () => {
    const points = [
      { id: 'p1', text: 'Hvor du bor', keywords: ['bor i'], required: true },
      { id: 'p2', text: 'Hva du jobber med', keywords: ['jobber som'], required: true },
    ];
    const { user } = renderStep(doc({ points }));

    await user.type(
      screen.getByLabelText('Try a student text'),
      'Jeg bor i Bergen nå.{Enter}{Enter}Jeg jobber som sykepleier.',
    );

    expect(screen.getByText(/2 paragraphs · 2\/2 points/)).toBeInTheDocument();
    expect(
      screen.getByText(/The language criterion is a placeholder until a model is connected./),
    ).toBeInTheDocument();
  });

  it('names the verdict the same threshold the queue will use', async () => {
    const { user } = renderStep(doc({ settings: { ...doc().settings, passScore: 1 } }));

    await user.type(screen.getByLabelText('Try a student text'), 'Jeg bor i Bergen.');

    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('offers no mark for a criterion with no metric rather than a borrowed one', async () => {
    const base = doc();
    const rubric = base.rubric.map((c, i) => (i === 0 ? { ...c, metric: null } : c));
    const { user } = renderStep(doc({ rubric }));

    await user.type(screen.getByLabelText('Try a student text'), 'Jeg bor i Bergen.');

    expect(screen.getByText('No suggestion for this criterion.')).toBeInTheDocument();
  });
});
