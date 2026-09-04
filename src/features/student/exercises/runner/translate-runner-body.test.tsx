import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_FLOW, type StudentProjection } from '@/lib/shared-kernel/translate';

import { PRACTICE_ACCENT } from './types';

const useMediaAsset = vi.fn((_id?: string): { data: { id: string; url: string } | undefined } => ({
  data: undefined,
}));

vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));

beforeEach(() => {
  useMediaAsset.mockClear();
  useMediaAsset.mockReturnValue({ data: undefined });
});

const { TranslateRunnerBody } = await import('./translate-runner-body');
type TranslateValue = import('./translate-runner-body').TranslateValue;

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

/*
  A query client, because every sentence card runs the listening layer's engine, and the
  engine asks the network two questions: media-service for the clip, and — under
  `source: 'lesson'` — the lesson the recording is borrowed from (plan 56 §3.8). A card
  with no recording asks neither; the hooks still run, which is what needs the provider.
*/
function providers(ui: React.ReactElement) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function renderBody(props: Partial<React.ComponentProps<typeof TranslateRunnerBody>> = {}) {
  return render(
    providers(
      <TranslateRunnerBody
        projection={makeProjection()}
        value={{}}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />,
    ),
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
    render(providers(<Harness />));

    const [first, second] = screen.getAllByRole('textbox');
    await user.type(first!, 'Jeg har bodd i Tromsø i tre år.');
    expect(screen.getByTestId('can-submit')).toHaveTextContent('no');
    expect(screen.getByText('1/2 written')).toBeInTheDocument();

    await user.type(second!, 'Jeg liker katter.');
    expect(screen.getByTestId('can-submit')).toHaveTextContent('yes');
  });

  it('does not count whitespace as an answer', async () => {
    const user = userEvent.setup();
    render(providers(<Harness />));

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

  /**
   * The listening half of this template: the source is spoken, and the answer is a
   * translation of what was heard. Replaying is free — the exercise is not a memory test.
   */
  it('plays the recording of a sentence that has one, while the work is open', () => {
    useMediaAsset.mockReturnValue({ data: { id: 'media-9', url: 'https://cdn.test/a.mp3' } });
    renderBody({
      projection: makeProjection({
        dir: 'from_target',
        items: [
          {
            id: 'i1',
            dir: 'from_target',
            source: 'Jeg har bodd i Tromsø i tre år.',
            sourceLang: 'Norsk',
            answerLang: 'Russisk',
            gloss: [],
            mediaId: 'media-9',
          },
        ],
      }),
    });

    // The exercise player, not a bare `<audio controls>`: plan 56 phase 6 merged this
    // template's per-sentence recordings into the listening layer, so a teacher's rules
    // for hearing reach them. The clip is still the sentence's own.
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(useMediaAsset).toHaveBeenCalledWith('media-9');
  });

  it('takes the player away once the work has been handed in', () => {
    useMediaAsset.mockReturnValue({ data: { id: 'media-9', url: 'https://cdn.test/a.mp3' } });
    renderBody({
      phase: 'feedback',
      projection: makeProjection({
        items: [
          {
            id: 'i1',
            dir: 'from_target',
            source: 'Jeg har bodd i Tromsø i tre år.',
            sourceLang: 'Norsk',
            answerLang: 'Russisk',
            gloss: [],
            mediaId: 'media-9',
          },
        ],
      }),
    });

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });

  it('asks media-service for nothing when no sentence carries audio', () => {
    renderBody();

    // The hook runs for every card — hooks are not conditional — but a card with no
    // recording asks it about nothing, which is a lookup that never leaves the browser.
    expect(useMediaAsset).not.toHaveBeenCalledWith(expect.any(String));
  });

  /*
    The rules the merge buys — plan 56 phase 6. They are the exercise's, asked once, and
    they apply to each sentence's own recording: two plays means two plays of *this*
    sentence, and the gate opens *this* field.
  */
  it('locks a sentence behind its own recording when the teacher asked for it', () => {
    useMediaAsset.mockReturnValue({ data: { id: 'media-9', url: 'https://cdn.test/a.mp3' } });
    renderBody({
      projection: makeProjection({
        dir: 'from_target',
        audio: {
          enabled: true,
          source: 'items',
          settings: { gate: 'first', plays: 2, seek: false },
        },
        items: [
          {
            id: 'i1',
            dir: 'from_target',
            source: 'Jeg har bodd i Tromsø i tre år.',
            sourceLang: 'Norsk',
            answerLang: 'Russisk',
            gloss: [],
            mediaId: 'media-9',
          },
        ],
      } as Parameters<typeof makeProjection>[0]),
    });

    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(
      screen.getByText('This sentence opens once you have heard its recording.'),
    ).toBeInTheDocument();
  });

  it('leaves the field open when the exercise carries no rules at all', () => {
    // A set written before the merge: it plays exactly as freely as plan 42 made it.
    useMediaAsset.mockReturnValue({ data: { id: 'media-9', url: 'https://cdn.test/a.mp3' } });
    renderBody({
      projection: makeProjection({
        dir: 'from_target',
        items: [
          {
            id: 'i1',
            dir: 'from_target',
            source: 'Jeg har bodd i Tromsø i tre år.',
            sourceLang: 'Norsk',
            answerLang: 'Russisk',
            gloss: [],
            mediaId: 'media-9',
          },
        ],
      }),
    });

    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
  });
});
