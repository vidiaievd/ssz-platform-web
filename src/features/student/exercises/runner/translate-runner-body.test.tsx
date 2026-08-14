import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_FLOW, type StudentProjection } from '@/lib/shared-kernel/translate';

import { PRACTICE_ACCENT } from './types';
import { TranslateRunnerBody, type TranslateValue } from './translate-runner-body';

/**
 * The exercise as the server sends it. There is no accepted translation anywhere in
 * here, and that is the point: for this template the key is the answer.
 */
function makeProjection(overrides: Partial<StudentProjection> = {}): StudentProjection {
  return {
    dir: 'to_target',
    langs: { explain: 'Russisk', target: 'Norsk' },
    format: 'set',
    note: 'Bruk perfektum.',
    items: [
      {
        id: 'i1',
        dir: 'to_target',
        source: 'Я живу в Тромсё три года.',
        sourceLang: 'Russisk',
        answerLang: 'Norsk',
        hint: 'Perfektum: har + partisipp.',
        gloss: [{ w: 'уже', t: 'allerede' }],
      },
      {
        id: 'i2',
        dir: 'to_target',
        source: 'Я люблю кошек.',
        sourceLang: 'Russisk',
        answerLang: 'Norsk',
        gloss: [],
      },
    ],
    flow: { ...DEFAULT_FLOW, charCount: true },
    exactPasses: true,
    ...overrides,
  };
}

function renderBody(props: Partial<React.ComponentProps<typeof TranslateRunnerBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TranslateRunnerBody
        projection={makeProjection()}
        value={{}}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

/** Wired the way the solver wires it, for the tests that type. */
function Harness({ projection = makeProjection() }: { projection?: StudentProjection }) {
  const [value, setValue] = useState<TranslateValue>({});
  const [canSubmit, setCanSubmit] = useState(false);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TranslateRunnerBody
        projection={projection}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanSubmit}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
      />
      <span data-testid="can-submit">{canSubmit ? 'yes' : 'no'}</span>
    </NextIntlClientProvider>
  );
}

describe('TranslateRunnerBody', () => {
  it('shows every sentence to translate, with a field for each', () => {
    renderBody();

    expect(screen.getByText('Я живу в Тромсё три года.')).toBeInTheDocument();
    expect(screen.getByText('Я люблю кошек.')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('names the direction of the set and the language each sentence is read in', () => {
    renderBody();

    expect(screen.getByText('Russisk → Norsk')).toBeInTheDocument();
    expect(screen.getByText('1. Russisk')).toBeInTheDocument();
  });

  it('reports the whole set is written only once every sentence has an answer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const [first, second] = screen.getAllByRole('textbox');
    await user.type(first!, 'Jeg har bodd i Tromsø i tre år.');
    expect(screen.getByTestId('can-submit')).toHaveTextContent('no');
    expect(screen.getByText('1/2 written')).toBeInTheDocument();

    await user.type(second!, 'Jeg liker katter.');
    expect(screen.getByTestId('can-submit')).toHaveTextContent('yes');
  });

  it('does not count whitespace as an answer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const [first, second] = screen.getAllByRole('textbox');
    await user.type(first!, '   ');
    await user.type(second!, '   ');

    expect(screen.getByTestId('can-submit')).toHaveTextContent('no');
  });

  it('keeps the hint shut until the learner opens it', async () => {
    const user = userEvent.setup();
    renderBody();

    expect(screen.queryByText('Perfektum: har + partisipp.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByText('Perfektum: har + partisipp.')).toBeInTheDocument();
  });

  it('offers the Norwegian letters when the answer is written in Norwegian', () => {
    renderBody();

    expect(screen.getAllByRole('group', { name: 'Norwegian letters' })).toHaveLength(2);
  });

  it('withholds them when the answer is written in the language of explanation', () => {
    const projection = makeProjection();
    const [first] = projection.items;
    renderBody({
      projection: {
        ...projection,
        dir: 'from_target',
        items: [{ ...first!, dir: 'from_target', sourceLang: 'Norsk', answerLang: 'Russisk' }],
      },
    });

    expect(screen.queryByRole('group', { name: 'Norwegian letters' })).not.toBeInTheDocument();
  });

  it('says which sentences the server closed and which went to a teacher', () => {
    renderBody({
      phase: 'feedback',
      value: { i1: 'Jeg har bodd i Tromsø i tre år.', i2: 'Jeg elsker katter.' },
      routing: { i1: 'pass', i2: 'teacher' },
    });

    expect(screen.getByText('Approved automatically')).toBeInTheDocument();
    expect(screen.getByText('Waiting for a teacher')).toBeInTheDocument();
  });

  it('says nothing about a sentence before the work is handed in', () => {
    renderBody();

    expect(screen.queryByText('Approved automatically')).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting for a teacher')).not.toBeInTheDocument();
  });

  it('reports a self-check per sentence, in the wording its verdict allows', () => {
    renderBody({
      value: { i1: 'Jeg bor i Tromsø i tre år.', i2: 'Katter.' },
      selfCheck: {
        passing: 0,
        items: [
          {
            itemId: 'i1',
            verdict: 'near',
            sim: 0.8,
            tokens: [
              { t: 'eq', w: 'Jeg', typo: null },
              { t: 'extra', w: 'bor', typo: null },
              { t: 'missing', w: '•••', typo: null },
            ],
            missing: [],
            banned: [],
          },
          {
            itemId: 'i2',
            verdict: 'off',
            sim: 0.2,
            divergingWords: 4,
            missing: [],
            banned: [],
          },
        ],
      },
    });

    expect(screen.getByText('Close — something differs from the key.')).toBeInTheDocument();
    expect(screen.getByText('This is some way from the key.')).toBeInTheDocument();
    // `off` gets a count rather than a diff — at that distance the diff is mostly mask.
    expect(
      screen.getByText('4 words differ from the key. Read the sentence again.'),
    ).toBeInTheDocument();
    // The legend belongs to the diff, and one sentence has one.
    expect(screen.getByText('missing from the key')).toBeInTheDocument();
  });

  // The rule the whole panel is built around: repeated checks must not spell out the key.
  it('shows the key’s own words only as the mask the server sent', () => {
    renderBody({
      value: { i1: 'Jeg bor her.' },
      selfCheck: {
        passing: 0,
        items: [
          {
            itemId: 'i1',
            verdict: 'typo',
            sim: 0.9,
            tokens: [
              { t: 'eq', w: 'Jeg', typo: null },
              { t: 'missing', w: '•••', typo: null },
              { t: 'eq', w: 'her.', typo: 'her.' },
            ],
            missing: [],
            banned: [],
          },
        ],
      },
    });

    expect(screen.getByText('Right — check the spelling.')).toBeInTheDocument();
    expect(screen.getByText('•••')).toBeInTheDocument();
    expect(screen.queryByText('bodd')).not.toBeInTheDocument();
  });

  it('keeps the self-check off the screen once the work is handed in', () => {
    renderBody({
      phase: 'feedback',
      value: { i1: 'Jeg bor i Tromsø i tre år.' },
      routing: { i1: 'teacher' },
      selfCheck: {
        passing: 0,
        items: [
          { itemId: 'i1', verdict: 'off', sim: 0.2, divergingWords: 4, missing: [], banned: [] },
        ],
      },
    });

    expect(screen.queryByText('This is some way from the key.')).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for a teacher')).toBeInTheDocument();
  });

  it('locks the fields once the work is with the teacher', () => {
    renderBody({ phase: 'feedback', value: { i1: 'Jeg har bodd her.', i2: 'Jeg liker katter.' } });

    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toHaveAttribute('readonly');
    }
  });
});
