import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { StudentProjection } from '@/lib/shared-kernel/writing-task';

import {
  submitGate,
  WritingTaskBody,
  type WritingTaskPhase,
  type WritingTaskValue,
} from './writing-task-body';

/**
 * The task as the server projects it: material, checklist points without their keywords,
 * phrases, and the settings that decide what the screen offers. No model answer, no
 * keywords, no descriptors — those are the answer key, and the runner never holds it.
 */
function makeTask(overrides: Partial<StudentProjection> = {}): StudentProjection {
  return {
    mode: 'letter',
    instruction: 'Skriv et brev til kommunen.',
    prompt: 'Svømmehallen skal stenge. Skriv et brev og foreslå noe annet.',
    letter: { recipient: 'Oslo kommune', register: 'formal' },
    points: [
      { id: 'p1', text: 'Presenter deg selv', required: true },
      { id: 'p2', text: 'Skriv hva hallen betyr for deg', required: true },
    ],
    phrases: ['Jeg foreslår at', 'Med vennlig hilsen'],
    rubricMax: 15,
    settings: {
      minWords: 120,
      maxWords: 200,
      timer: 0,
      blockPaste: true,
      autosave: true,
      showWordCount: true,
      showPlan: true,
      showPhrases: true,
      showRubric: 'afterGraded',
      showModel: 'afterGraded',
      passScore: 8,
      revision: 'return',
    },
    ...overrides,
  };
}

/** `n` words the tokeniser will actually count as `n`. */
function text(n: number): string {
  return Array.from({ length: n }, (_, i) => `ord${i}`).join(' ');
}

function wrap(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

/** The body holds no text of its own — the caller does, exactly as the solver will. */
function Harness({
  task,
  phase = 'draft',
  initial = { text: '', ticked: [] },
  ...rest
}: {
  task: StudentProjection;
  phase?: WritingTaskPhase;
  initial?: WritingTaskValue;
  interactive?: boolean;
  attemptNo?: number;
  saveState?: 'idle' | 'saving' | 'saved';
  imageUrl?: string | null;
}) {
  const [value, setValue] = useState<WritingTaskValue>(initial);
  return (
    <WritingTaskBody
      task={task}
      value={value}
      onValueChange={setValue}
      phase={phase}
      accent="#123456"
      {...rest}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('submitGate', () => {
  it('refuses an empty text, a short one, and one over the ceiling', () => {
    const task = makeTask();

    expect(submitGate(task, '   ')).toEqual({ canSubmit: false, block: 'empty', remaining: 0 });
    expect(submitGate(task, text(100))).toEqual({
      canSubmit: false,
      block: 'short',
      remaining: 20,
    });
    expect(submitGate(task, text(201)).block).toBe('long');
    expect(submitGate(task, text(150))).toEqual({ canSubmit: true, block: null, remaining: 0 });
  });

  it('never gates on the minimum the author switched off', () => {
    const task = makeTask({
      settings: { ...makeTask().settings, minWords: 0, maxWords: 0 },
    });

    expect(submitGate(task, 'Ett ord til.').canSubmit).toBe(true);
    expect(submitGate(task, text(5000)).canSubmit).toBe(true);
  });

  it('ignores the checklist — ticking is the learner’s own tracking', () => {
    const task = makeTask();
    // The same text, judged the same way, whatever the learner ticked (BEHAVIOR §7).
    expect(submitGate(task, text(150)).canSubmit).toBe(true);
  });
});

describe('WritingTaskBody', () => {
  it('renders the material its mode calls for, and nothing else', () => {
    render(wrap(<Harness task={makeTask()} />));

    expect(screen.getByText(/Oslo kommune/)).toBeInTheDocument();
    expect(screen.getByText(/formal language/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows a retell source and a picture only in their own modes', () => {
    const { unmount } = render(
      wrap(<Harness task={makeTask({ mode: 'retell', source: 'Bartek søker ny jobb.' })} />),
    );
    expect(screen.getByText('Bartek søker ny jobb.')).toBeInTheDocument();
    unmount();

    render(
      wrap(
        <Harness
          task={makeTask({ mode: 'picture', image: { caption: 'På torget', alt: 'Et torg' } })}
          imageUrl="https://media.example/asset.jpg"
        />,
      ),
    );
    expect(screen.getByAltText('Et torg')).toBeInTheDocument();
    expect(screen.getByText('På torget')).toBeInTheDocument();
  });

  it('draws a placeholder rather than a broken picture when the asset is unresolved', () => {
    render(wrap(<Harness task={makeTask({ mode: 'picture', image: { caption: '', alt: '' } })} />));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('the picture from the task')).toBeInTheDocument();
  });

  it('ticks a checklist item without touching the text', async () => {
    const user = userEvent.setup();
    render(wrap(<Harness task={makeTask()} initial={{ text: 'Hei', ticked: [] }} />));

    const row = screen.getByRole('checkbox', { name: /Presenter deg selv/ });
    expect(row).toHaveAttribute('aria-checked', 'false');

    await user.click(row);

    expect(screen.getByRole('checkbox', { name: /Presenter deg selv/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'Your text' })).toHaveValue('Hei');
  });

  it('appends a phrase to the text, spaced', async () => {
    const user = userEvent.setup();
    render(wrap(<Harness task={makeTask()} initial={{ text: 'Hei.', ticked: [] }} />));

    await user.click(screen.getByRole('button', { name: 'Jeg foreslår at' }));

    expect(screen.getByRole('textbox', { name: 'Your text' })).toHaveValue('Hei. Jeg foreslår at ');
  });

  it('cancels a blocked paste and says why, keeping what was already written', async () => {
    const user = userEvent.setup();
    render(wrap(<Harness task={makeTask()} initial={{ text: 'Mitt eget', ticked: [] }} />));

    const field = screen.getByRole('textbox', { name: 'Your text' });
    await user.click(field);
    await user.paste('limt inn tekst');

    expect(field).toHaveValue('Mitt eget');
    expect(
      screen.getByText('Pasting is turned off for this task — write the text yourself.'),
    ).toBeInTheDocument();
  });

  it('lets the paste through when the author allowed it', async () => {
    const user = userEvent.setup();
    const task = makeTask({ settings: { ...makeTask().settings, blockPaste: false } });
    render(wrap(<Harness task={task} initial={{ text: '', ticked: [] }} />));

    const field = screen.getByRole('textbox', { name: 'Your text' });
    await user.click(field);
    await user.paste('limt inn tekst');

    expect(field).toHaveValue('limt inn tekst');
    expect(screen.queryByText(/Pasting is turned off/)).not.toBeInTheDocument();
  });

  it('counts words against the author’s range, and hides the count when told to', () => {
    const { unmount } = render(
      wrap(<Harness task={makeTask()} initial={{ text: text(42), ticked: [] }} />),
    );
    expect(screen.getByText('42 / 120–200 words')).toBeInTheDocument();
    unmount();

    const quiet = makeTask({ settings: { ...makeTask().settings, showWordCount: false } });
    render(wrap(<Harness task={quiet} initial={{ text: text(42), ticked: [] }} />));
    expect(screen.queryByText(/words$/)).not.toBeInTheDocument();
  });

  it('reads an open ceiling as a minimum with no upper bound', () => {
    const task = makeTask({ settings: { ...makeTask().settings, maxWords: 0 } });
    render(wrap(<Harness task={task} initial={{ text: text(42), ticked: [] }} />));

    expect(screen.getByText('42 / 120+ words')).toBeInTheDocument();
  });

  it('starts the countdown on the first keystroke, not on mount', () => {
    vi.useFakeTimers();
    const task = makeTask({ settings: { ...makeTask().settings, timer: 20 } });
    render(wrap(<Harness task={task} />));

    // Mounted and left alone: a task opened and not written in spends no time.
    expect(screen.getByText('20:00')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('20:00')).toBeInTheDocument();

    // `fireEvent` rather than `userEvent`: typing under fake timers waits on timers the
    // test itself controls, and the countdown is the only thing being measured here.
    fireEvent.change(screen.getByRole('textbox', { name: 'Your text' }), {
      target: { value: 'Hei' },
    });
    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByText('19:57')).toBeInTheDocument();
  });

  it('shows the rubric while writing only when the author made it a guide', () => {
    const guided = makeTask({
      settings: { ...makeTask().settings, showRubric: 'always' },
      rubric: [
        {
          id: 'c1',
          name: 'Innhold',
          desc: 'Alle punktene er med',
          weight: 2,
          levels: ['Mangler', 'Delvis', 'Bra', 'Alle punktene er dekket'],
        },
      ],
    });
    const { unmount } = render(wrap(<Harness task={guided} />));

    const guide = screen.getByText('How the text is graded').closest('div')!;
    expect(within(guide).getByText('8 of 15 points to pass')).toBeInTheDocument();
    expect(screen.getByText('Innhold')).toBeInTheDocument();
    expect(screen.getByText('3 — Alle punktene er dekket')).toBeInTheDocument();
    unmount();

    // The default: the rubric explains the mark afterwards, so the server sends no
    // criteria and there is nothing to draw.
    render(wrap(<Harness task={makeTask()} />));
    expect(screen.queryByText('How the text is graded')).not.toBeInTheDocument();
  });

  it('turns the text into a read-only quote once it has been handed in', () => {
    render(
      wrap(
        <Harness task={makeTask()} phase="sent" initial={{ text: 'Levert tekst', ticked: [] }} />,
      ),
    );

    expect(screen.queryByRole('textbox', { name: 'Your text' })).not.toBeInTheDocument();
    expect(screen.getByText('Levert tekst')).toBeInTheDocument();
  });

  it('keeps the surfaces but refuses input when it is not the learner’s to edit', async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <Harness task={makeTask()} interactive={false} initial={{ text: 'Fast', ticked: [] }} />,
      ),
    );

    await user.click(screen.getByRole('checkbox', { name: /Presenter deg selv/ }));
    expect(screen.getByRole('checkbox', { name: /Presenter deg selv/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('textbox', { name: 'Your text' })).toHaveAttribute('readonly');
  });

  it('names the try from the second one on', () => {
    render(wrap(<Harness task={makeTask()} attemptNo={2} />));

    expect(screen.getByText(/submission 2/)).toBeInTheDocument();
  });

  it('says the draft is being saved only while it is', () => {
    const { unmount } = render(wrap(<Harness task={makeTask()} saveState="saving" />));
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    unmount();

    render(wrap(<Harness task={makeTask()} />));
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
  });
});
