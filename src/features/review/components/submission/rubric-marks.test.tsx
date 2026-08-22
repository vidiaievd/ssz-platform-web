import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { WritingTaskDetails } from '@/features/content-authoring/types/review';
import type { RubricSnapshot } from '@/lib/shared-kernel/writing-task';

import { RubricMarks } from './rubric-marks';

const snapshot: RubricSnapshot = {
  passScore: 8,
  criteria: [
    {
      id: 'c-task',
      name: 'Oppgaveløsning',
      desc: 'Er alle punktene dekket?',
      weight: 2,
      levels: ['Svarer ikke', 'Ett punkt', 'De fleste punktene', 'Alle punktene og utdypet'],
    },
    {
      id: 'c-lang',
      name: 'Språk',
      desc: 'Setningsbygning og verbtider.',
      weight: 1,
      levels: ['Uforståelig', 'Mange feil', 'Noen feil', 'Få feil'],
    },
  ],
};

const details: WritingTaskDetails = {
  totalItems: 1,
  passedItems: 0,
  wordCount: 187,
  paragraphs: 3,
  uniqueWords: 112,
  length: 'ok',
  hitCount: 1,
  neededCount: 2,
  points: [
    { id: 'p1', text: 'Hvor du bor', required: true, hit: true, ticked: true },
    { id: 'p2', text: 'Hva du jobber med', required: true, hit: false, ticked: true },
  ],
};

function Harness({
  editable = true,
  initial = {},
  facts = details,
}: {
  editable?: boolean;
  initial?: Record<string, number>;
  facts?: WritingTaskDetails | null;
}) {
  const [marks, setMarks] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <RubricMarks
        snapshot={snapshot}
        marks={marks}
        details={facts}
        editable={editable}
        onMark={(id, mark) => setMarks((current) => ({ ...current, [id]: mark }))}
      />
    </NextIntlClientProvider>
  );
}

function renderRubric(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  return { user: userEvent.setup() };
}

describe('the marks', () => {
  // The one rule this screen exists to keep (plan 50 §4): nothing is pre-filled, so
  // nothing is confirmed by a tired teacher who never looked.
  it('starts every criterion unmarked, and says so rather than showing a zero', () => {
    renderRubric();

    const task = screen.getByRole('radiogroup', { name: 'Mark for Oppgaveløsning' });
    for (const mark of ['0', '1', '2', '3']) {
      expect(within(task).getByRole('radio', { name: mark })).not.toBeChecked();
    }
    expect(screen.getByText('2 criteria left')).toBeInTheDocument();
  });

  it('shows what the criterion is about until a mark is set, then what the mark means', async () => {
    const { user } = renderRubric();

    expect(screen.getByText('Er alle punktene dekket?')).toBeInTheDocument();

    const task = screen.getByRole('radiogroup', { name: 'Mark for Oppgaveløsning' });
    await user.click(within(task).getByRole('radio', { name: '2' }));

    expect(screen.getByText('De fleste punktene')).toBeInTheDocument();
    expect(screen.queryByText('Er alle punktene dekket?')).not.toBeInTheDocument();
  });

  it('weighs a criterion where the author said it weighs double', async () => {
    const { user } = renderRubric();

    const task = screen.getByRole('radiogroup', { name: 'Mark for Oppgaveløsning' });
    await user.click(within(task).getByRole('radio', { name: '3' }));

    // 3 × 2, out of 3 × 2 + 3 × 1.
    expect(screen.getByText('6 of 9 points')).toBeInTheDocument();
  });

  it('counts down what is still unmarked and stops when the rubric is whole', async () => {
    const { user } = renderRubric({ initial: { 'c-task': 2 } });

    expect(screen.getByText('1 criterion left')).toBeInTheDocument();

    const lang = screen.getByRole('radiogroup', { name: 'Mark for Språk' });
    await user.click(within(lang).getByRole('radio', { name: '0' }));

    expect(screen.queryByText(/criter(ion|ia) left/)).not.toBeInTheDocument();
    expect(screen.getByText('4 of 9 points')).toBeInTheDocument();
  });

  it('states the threshold beside the running score', () => {
    renderRubric();

    expect(screen.getByText('a pass is 8')).toBeInTheDocument();
  });

  // A verdict has landed; the rubric is now a record, and a control that only looked
  // inert would still take the keyboard.
  it('is genuinely disabled once it is no longer editable', () => {
    renderRubric({ editable: false, initial: { 'c-task': 3, 'c-lang': 2 } });

    const task = screen.getByRole('radiogroup', { name: 'Mark for Oppgaveløsning' });
    expect(within(task).getByRole('radio', { name: '3' })).toBeDisabled();
  });
});

describe('the facts', () => {
  it('states what was measured, which is nothing that moves the score', () => {
    renderRubric();

    expect(screen.getByText(/187 words · 3 paragraphs · 1\/2 points phrased/)).toBeInTheDocument();
  });

  it('names a text that misses the length the author asked for', () => {
    renderRubric({ facts: { ...details, length: 'short' } });

    expect(screen.getByText(/under the length asked for/)).toBeInTheDocument();
  });

  it('chips a point the keywords found, and one they did not', () => {
    renderRubric();

    expect(screen.getByText('Hvor du bor')).toBeInTheDocument();
    expect(screen.getByText('Hva du jobber med')).toBeInTheDocument();
  });

  // The interesting disagreement: the learner says they covered it, the keywords say
  // otherwise. Named rather than drawn as a failure — it is evidence of nothing on its own.
  it('marks a point the learner ticked but the keywords missed', () => {
    renderRubric();

    const chip = screen.getByText('Hva du jobber med').closest('li')!;
    expect(within(chip).getByText('ticked')).toBeInTheDocument();
    expect(chip).toHaveAttribute('title', expect.stringContaining('phrased it another way'));
  });

  it('says nothing at all when the breakdown could not be read', () => {
    renderRubric({ facts: null });

    expect(screen.queryByText(/points phrased/)).not.toBeInTheDocument();
    // The marking itself is unaffected: a rubric does not need a word count.
    expect(screen.getByRole('radiogroup', { name: 'Mark for Språk' })).toBeInTheDocument();
  });
});
