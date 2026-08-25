import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_SETTINGS,
  type StudentProjection,
  type StudentResult,
} from '@/lib/shared-kernel/short-answer';

import { ShortAnswerBody, type ShortAnswerPhase } from './short-answer-body';

function makeSet(overrides: Partial<StudentProjection> = {}): StudentProjection {
  const { settings, ...rest } = overrides;
  return {
    instruction: 'Svar med egne ord.',
    questions: [
      {
        id: 'sa1',
        kind: 'reading',
        prompt: 'Hvor lenge har Bartek jobbet i det samme firmaet?',
        passage: 'Bartek har jobbet som elektriker i det samme firmaet i tre år.',
      },
      { id: 'sa2', kind: 'opinion', prompt: 'Hva ville du gjort?' },
    ],
    settings: {
      passRule: DEFAULT_SETTINGS.passRule,
      passN: DEFAULT_SETTINGS.passN,
      minWords: DEFAULT_SETTINGS.minWords,
      showBreakdown: DEFAULT_SETTINGS.showBreakdown,
      showModel: DEFAULT_SETTINGS.showModel,
      aiStage: DEFAULT_SETTINGS.aiStage,
      aiGrammar: DEFAULT_SETTINGS.aiGrammar,
      teacherReview: DEFAULT_SETTINGS.teacherReview,
      progress: DEFAULT_SETTINGS.progress,
      ...settings,
    },
    ...rest,
  };
}

/** A verdict as the server projects it: labels with a hit flag, never the anchors. */
function makeResult(overrides: Partial<StudentResult> = {}): StudentResult {
  return {
    questionId: 'sa1',
    verdict: 'partial',
    covered: 1,
    total: 2,
    tooShort: false,
    hits: [
      { id: 'e1', label: 'Mer ansvar', required: true, hit: true },
      { id: 'e2', label: 'Høyere lønn', required: true, hit: false },
    ],
    why: 'Teksten nevner to ting han ønsker seg.',
    ...overrides,
  };
}

function wrap(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

interface HarnessProps {
  set?: StudentProjection;
  phase?: ShortAnswerPhase;
  result?: StudentResult | null;
  index?: number;
  onSubmit?: () => void;
  onNext?: () => void;
  onRestart?: () => void;
  error?: string | null;
  sending?: boolean;
  showProgressBar?: boolean;
}

/** The body owns nothing but the text; the harness plays the solver around it. */
function Harness({
  set = makeSet(),
  phase = 'writing',
  result = null,
  index = 0,
  onSubmit = () => {},
  onNext = () => {},
  onRestart,
  error = null,
  sending = false,
  showProgressBar = true,
}: HarnessProps) {
  const [value, setValue] = useState('');
  return (
    <ShortAnswerBody
      set={set}
      index={index}
      value={value}
      onValueChange={setValue}
      phase={phase}
      result={result}
      tally={{ pass: 1, partial: 1, fail: 0 }}
      sending={sending}
      error={error}
      onSubmit={onSubmit}
      onNext={onNext}
      {...(onRestart === undefined ? {} : { onRestart })}
      showProgressBar={showProgressBar}
      accent="var(--ssz-runner-practice)"
    />
  );
}

describe('ShortAnswerBody', () => {
  it('shows the passage, the prompt and the field — and nothing that gives the answer away', () => {
    render(wrap(<Harness />));

    expect(screen.getByText(/Bartek har jobbet som elektriker/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Hvor lenge har Bartek jobbet/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // The handoff's decision, in as many words: only the input field. A word counter
    // would turn a question about understanding into a question about length.
    expect(screen.queryByText(/\bwords\b/i)).not.toBeInTheDocument();
  });

  it('will not hand in an empty answer, and says the hand-in is final', async () => {
    const onSubmit = vi.fn();
    render(wrap(<Harness onSubmit={onSubmit} />));

    const button = screen.getByRole('button', { name: /hand in answer/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/cannot be changed once handed in/i)).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'I tre år.');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('draws the result card the server sent: verdict, coverage, breakdown, why, routing', () => {
    render(wrap(<Harness phase="submitted" result={makeResult()} />));

    const card = screen.getByRole('status');
    expect(card).toHaveTextContent('Partly');
    expect(card).toHaveTextContent('1 of 2 points covered');
    expect(card).toHaveTextContent('Mer ansvar');
    expect(card).toHaveTextContent('Høyere lønn');
    expect(card).toHaveTextContent('Teksten nevner to ting han ønsker seg.');
    // `teacherReview: 'flagged'` and a verdict short of a pass — a person reads this one.
    expect(card).toHaveTextContent('Sent to the teacher for review');
    expect(card).not.toHaveTextContent('if anything is unclear');
  });

  it('softens the routing line for a passed answer under "flagged"', () => {
    render(wrap(<Harness phase="submitted" result={makeResult({ verdict: 'pass' })} />));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Sent to the teacher for review if anything is unclear',
    );
  });

  it('says nothing about a teacher when no one is in the loop', () => {
    render(
      wrap(
        <Harness
          set={makeSet({ settings: { teacherReview: 'none' } as StudentProjection['settings'] })}
          phase="submitted"
          result={makeResult({ verdict: 'pass' })}
        />,
      ),
    );

    expect(screen.getByRole('status')).not.toHaveTextContent('teacher');
  });

  it('flags an answer too short to judge, without showing a count', () => {
    render(wrap(<Harness phase="submitted" result={makeResult({ tooShort: true })} />));

    expect(screen.getByRole('status')).toHaveTextContent('too short to be checked automatically');
  });

  it('locks the answer once it is in, but leaves it readable', () => {
    render(wrap(<Harness phase="submitted" result={makeResult()} />));

    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox')).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: /hand in answer/i })).not.toBeInTheDocument();
  });

  it('offers the next question, and "Finish" on the last one', async () => {
    const onNext = vi.fn();
    const { rerender } = render(
      wrap(<Harness phase="submitted" result={makeResult()} onNext={onNext} />),
    );

    await userEvent.click(screen.getByRole('button', { name: /next question/i }));
    expect(onNext).toHaveBeenCalledOnce();

    rerender(wrap(<Harness phase="submitted" index={1} result={makeResult()} onNext={onNext} />));
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
  });

  it('shows the model answer only when it arrived', () => {
    const { rerender } = render(wrap(<Harness phase="submitted" result={makeResult()} />));
    expect(screen.queryByText(/Sample answer/i)).not.toBeInTheDocument();

    rerender(
      wrap(<Harness phase="submitted" result={makeResult({ model: 'Han vil ha mer ansvar.' })} />),
    );
    expect(screen.getByText(/Han vil ha mer ansvar\./)).toBeInTheDocument();
  });

  it('marks the AI stage as unbuilt rather than implying a check that did not happen', () => {
    render(
      wrap(
        <Harness
          set={makeSet({ settings: { aiStage: true } as StudentProjection['settings'] })}
          phase="submitted"
          result={makeResult()}
        />,
      ),
    );

    const card = screen.getByRole('status');
    expect(card).toHaveTextContent('AI comment');
    expect(card).toHaveTextContent('coming');
    expect(card).toHaveTextContent('Checked by AI · passed on to the teacher');
  });

  it('counts the set on the done screen and offers another go', async () => {
    const onRestart = vi.fn();
    render(wrap(<Harness phase="done" onRestart={onRestart} />));

    expect(screen.getByRole('status')).toHaveTextContent('1 passed · 1 partly · 0 not passed');
    expect(screen.getByRole('status')).toHaveTextContent('looking through your answers');

    await userEvent.click(screen.getByRole('button', { name: /do it again/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('drops its own progress bar inside a stack, and keeps saying which question is open', () => {
    const { container } = render(wrap(<Harness showProgressBar={false} />));

    // The bar is the only transitioning element in the header; the counter is text.
    expect(container.querySelector('.transition-\\[width\\]')).toBeNull();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('draws its own progress bar when it owns the screen', () => {
    const { container } = render(wrap(<Harness />));

    expect(container.querySelector('.transition-\\[width\\]')).not.toBeNull();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('has nothing to show when the set holds no answerable question', () => {
    render(wrap(<Harness set={makeSet({ questions: [] })} />));

    expect(screen.getByText(/Nothing to answer yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reports a failed hand-in where the button is', () => {
    render(wrap(<Harness error="The answer was not handed in. Please try again." />));

    expect(screen.getByText(/was not handed in/i)).toBeInTheDocument();
  });
});
