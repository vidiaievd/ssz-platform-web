import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ExerciseDisplay } from '@/features/content/types';
import { PlacementQuestionRunner } from './placement-question-runner';
import { usePlacementStore } from '../stores/placement-store';

function display(id: string, content: Record<string, unknown>): ExerciseDisplay {
  return {
    id,
    templateCode: 'multiple_choice',
    content,
    targetLanguage: 'nb',
    difficultyLevel: 'A2',
    instructions: [],
  } as unknown as ExerciseDisplay;
}

const OLD_FORM = display('old-1', {
  question: 'Hva heter du?',
  options: [
    { id: 'o1', text: 'Jeg heter Kari' },
    { id: 'o2', text: 'Jeg er Kari' },
  ],
  expected_answers: { correct_option_ids: ['o1'] },
});

/** A set: nothing here for a runner that draws one question and grades it in the browser. */
const SET = display('set-1', {
  title: '',
  instruction: 'Velg riktig form.',
  questions: [{ id: 'q1', kind: 'grammar', context: '', stem: 'Han ___ i går.', options: [] }],
  settings: {},
});

function renderRunner(question: ExerciseDisplay) {
  usePlacementStore.getState().configure('inline');
  usePlacementStore.getState().startTest();
  usePlacementStore.getState().setQuestion(question);

  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PlacementQuestionRunner />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => usePlacementStore.getState().reset());

describe('PlacementQuestionRunner — a question it cannot play', () => {
  it('draws the question when the document is the old single-question form', () => {
    renderRunner(OLD_FORM);

    expect(screen.getByText('Hva heter du?')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so instead of rendering an empty question', () => {
    renderRunner(SET);

    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent(enMessages.Placement.runner.unplayable.title);
  });

  it('asks for another question without recording an answer', () => {
    renderRunner(SET);
    const before = usePlacementStore.getState();
    expect(before.questionNumber).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: enMessages.Placement.runner.unplayable.skip }));

    const after = usePlacementStore.getState();
    expect(after.flowState).toBe('loading');
    // Not an answer: the staircase has not moved.
    expect(after.questionNumber).toBe(0);
    expect(after.levelIndex).toBe(before.levelIndex);
    // Remembered anyway, so the next draw cannot hand back the same unplayable document.
    expect(after.askedQuestionIds).toContain('set-1');
  });
});
