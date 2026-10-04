import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, newSegment, type DictationContent } from '@/lib/shared-kernel/dictation';

import { StepKey } from './step-key';

// The author's engine, with the one thing the step reads: where the player is. jsdom does
// not play, so a test sets the position and watches what the buttons do with it.
const engine = vi.hoisted(() => ({ pos: 0, playRange: vi.fn() }));
vi.mock('@/features/student/exercises/audio', () => ({
  useExerciseAudio: () => ({ state: { pos: engine.pos }, playRange: engine.playRange }),
  ExerciseAudioPlayer: () => <div data-testid="author-player" />,
}));

function Harness({
  initial,
  spy,
}: {
  initial: DictationContent;
  spy: (ex: DictationContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  const [estimated, setEstimated] = useState<ReadonlySet<string>>(new Set());
  return (
    <StepKey
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
      estimated={estimated}
      onEstimatedChange={setEstimated}
    />
  );
}

function draw(initial: DictationContent) {
  const spy = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} />
    </NextIntlClientProvider>,
  );
  return { ...view, spy, last: () => spy.mock.calls.at(-1)?.[0] as DictationContent };
}

const seg = (text: string, audio: { start: number; end: number } | null = null) => ({
  ...newSegment(),
  text,
  audio,
});

const keyed = (...segments: ReturnType<typeof seg>[]): DictationContent => {
  const base = emptyContent('nb');
  return { ...base, audio: { ...base.audio, duration: 30 }, segments };
};

const PASTE = 'Jeg bor i Oslo. Hun bor i Bergen! Vi bor sammen.';

describe('StepKey — paste and split (AC-B2)', () => {
  it('offers the paste card only while the key is empty', () => {
    draw(emptyContent('nb'));
    expect(screen.getByRole('textbox', { name: 'Paste the whole text once' })).toBeInTheDocument();
    draw(keyed(seg('Jeg bor i Oslo.')));
    expect(screen.getAllByRole('textbox', { name: 'Paste the whole text once' })).toHaveLength(1);
  });

  it('splits one segment per sentence, with estimated timecodes labelled as such', async () => {
    const { last } = draw(keyed(seg('')));
    const button = screen.getByRole('button', { name: /^Split into/ });
    expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('textbox', { name: 'Paste the whole text once' }));
    await userEvent.paste(PASTE);
    expect(screen.getByRole('button', { name: 'Split into 3 segments' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Split into 3 segments' }));

    expect(last().segments.map((s) => s.text)).toEqual([
      'Jeg bor i Oslo.',
      'Hun bor i Bergen!',
      'Vi bor sammen.',
    ]);
    expect(last().segments.every((s) => s.audio !== null)).toBe(true);
    expect(screen.getAllByText('estimated')).toHaveLength(3);
    // The paste card goes once there is a key to protect.
    expect(screen.queryByRole('textbox', { name: 'Paste the whole text once' })).toBeNull();
  });

  it("drops the label from a segment once its timecode is the author's", async () => {
    draw(keyed(seg('')));
    await userEvent.click(screen.getByRole('textbox', { name: 'Paste the whole text once' }));
    await userEvent.paste(PASTE);
    await userEvent.click(screen.getByRole('button', { name: 'Split into 3 segments' }));

    const to = screen.getByLabelText('Segment 2 — To');
    await userEvent.clear(to);
    await userEvent.type(to, '0:21');
    expect(screen.getAllByText('estimated')).toHaveLength(2);
  });

  it('does not offer it in one continuous text, where one field is the whole key', () => {
    draw({ ...emptyContent('nb'), mode: 'whole' });
    expect(screen.queryByRole('textbox', { name: 'Paste the whole text once' })).toBeNull();
  });
});

describe('StepKey — timecodes (AC-B3, AC-B4)', () => {
  it('takes the player position as the start of that segment (AC-B3)', async () => {
    engine.pos = 12;
    const { last } = draw(
      keyed(seg('En.', { start: 0, end: 5 }), seg('To.', { start: 5, end: 9 })),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Set the start of segment 2 to the player position' }),
    );
    expect(last().segments[1]?.audio).toEqual({ start: 12, end: 9 });
    expect(last().segments[0]?.audio).toEqual({ start: 0, end: 5 });
    // And the field next to the button shows it — the one that used to ignore it.
    expect(screen.getByLabelText('Segment 2 — From')).toHaveValue('0:12');
  });

  it('takes it as the end as well', async () => {
    engine.pos = 7;
    const { last } = draw(keyed(seg('En.', { start: 2, end: 5 })));
    await userEvent.click(
      screen.getByRole('button', { name: 'Set the end of segment 1 to the player position' }),
    );
    expect(last().segments[0]?.audio).toEqual({ start: 2, end: 7 });
  });

  it('is disabled while the player is at the top — there is nothing to take', () => {
    engine.pos = 0;
    draw(keyed(seg('En.', { start: 0, end: 5 })));
    expect(
      screen.getByRole('button', { name: 'Set the start of segment 1 to the player position' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Set the end of segment 1 to the player position' }),
    ).toBeDisabled();
  });

  it('plays exactly the range of the segment (AC-B4), and nothing without one', async () => {
    engine.pos = 0;
    engine.playRange.mockClear();
    draw(keyed(seg('En.', { start: 3, end: 8 }), seg('To.')));
    expect(screen.getByRole('button', { name: 'Play segment 2' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Play segment 1' }));
    expect(engine.playRange).toHaveBeenCalledExactlyOnceWith(3, 8);
  });

  it('has no timecodes, Play or player in one continuous text', () => {
    draw({ ...keyed(seg('En to.')), mode: 'whole' });
    expect(screen.queryByRole('button', { name: /^Play segment/ })).toBeNull();
    expect(screen.queryByLabelText(/— From/)).toBeNull();
    expect(screen.queryByTestId('author-player')).toBeNull();
    expect(screen.getByText('The text')).toBeInTheDocument();
  });

  it('shows the player at the foot of the list, in the sentence-by-sentence shape', () => {
    draw(keyed(seg('En.')));
    expect(screen.getByTestId('author-player')).toBeInTheDocument();
  });
});

describe('StepKey — one continuous text (AC-B10)', () => {
  const two = () => {
    const a = { ...seg('Vi går.', { start: 0, end: 4 }), focus: [] };
    const b = {
      ...seg('Det regner nå.', { start: 4, end: 9 }),
      focus: [{ id: 'f1', wordIndex: 2, why: 'å' }],
    };
    return keyed(a, b);
  };

  it('shows the join before it is applied, and changes nothing yet', async () => {
    const { spy } = draw(two());
    await userEvent.click(screen.getByRole('radio', { name: 'One continuous text' }));

    expect(screen.getByText('2 sentences become one text.')).toBeInTheDocument();
    expect(screen.getByTestId('dc-join-text')).toHaveTextContent('Vi går. Det regner nå.');
    expect(screen.getByText('1 focus word moves with it.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    // Still two segments on screen.
    expect(screen.getAllByRole('textbox', { name: /^Segment \d: the sentence$/ })).toHaveLength(2);
  });

  it('applies on Apply: one segment, timecodes dropped, the focus word carried', async () => {
    const { last } = draw(two());
    await userEvent.click(screen.getByRole('radio', { name: 'One continuous text' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const out = last();
    expect(out.mode).toBe('whole');
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0]).toMatchObject({ text: 'Vi går. Det regner nå.', audio: null });
    expect(out.segments[0]?.focus).toEqual([{ id: 'f1', wordIndex: 4, why: 'å' }]);
    expect(out.audio.useSegments).toBe(false);
    expect(screen.queryByTestId('dc-join-text')).toBeNull();
  });

  it('cancels without touching the document', async () => {
    const { spy } = draw(two());
    await userEvent.click(screen.getByRole('radio', { name: 'One continuous text' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dc-join-text')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Sentence by sentence' })).toBeChecked();
  });

  it('switches at once when there is one sentence — nothing to join', async () => {
    const { last } = draw(keyed(seg('Vi går.')));
    await userEvent.click(screen.getByRole('radio', { name: 'One continuous text' }));
    expect(screen.queryByTestId('dc-join-text')).toBeNull();
    expect(last().mode).toBe('whole');
  });
});

describe('StepKey — the segments', () => {
  it('counts words, segments and timed ones', () => {
    draw(keyed(seg('Jeg bor i Oslo.', { start: 0, end: 4 }), seg('Hun bor der.')));
    expect(screen.getByText('2 segments · 7 words · 1 timed')).toBeInTheDocument();
    const first = screen.getByRole('textbox', { name: 'Segment 1: the sentence' });
    expect(first.closest('li')).toHaveTextContent('4 words');
  });

  it('edits the sentence, re-anchoring its focus words through the kernel', async () => {
    const s = {
      ...seg('Vi går til kjøkkenet.'),
      focus: [{ id: 'f1', wordIndex: 3, why: 'kj' }],
    };
    const { last } = draw(keyed(s));
    await userEvent.type(screen.getByRole('textbox', { name: 'Segment 1: the sentence' }), ' Nå.');
    expect(last().segments[0]?.focus).toEqual([{ id: 'f1', wordIndex: 3, why: 'kj' }]);
  });

  it('adds segments up to the ceiling of eight, then says so', async () => {
    draw(keyed(seg('En.')));
    for (let i = 0; i < 7; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Segment' }));
    }
    expect(screen.getAllByRole('textbox', { name: /the sentence$/ })).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Segment' })).toBeDisabled();
    expect(screen.getByText('8 is the ceiling — past that it is a lesson.')).toBeInTheDocument();
  });

  it('deletes a segment, but there is no button on the last one', async () => {
    const { last } = draw(keyed(seg('En.'), seg('To.')));
    await userEvent.click(screen.getByRole('button', { name: 'Delete segment 1' }));
    expect(last().segments.map((s) => s.text)).toEqual(['To.']);
    expect(screen.queryByRole('button', { name: /^Delete segment/ })).toBeNull();
  });

  it('puts what is wrong on the segment it is wrong about, by its place in the list', () => {
    const base = keyed(seg('Jeg bor i Oslo.', { start: 0, end: 4 }), seg(''));
    draw(base);
    const second = screen.getByRole('textbox', { name: 'Segment 2: the sentence' }).closest('li')!;
    expect(
      within(second).getByText('It is empty. Write the sentence or delete the segment.'),
    ).toBeInTheDocument();
    const first = screen.getByRole('textbox', { name: 'Segment 1: the sentence' }).closest('li')!;
    expect(within(first).queryByText(/It is empty/)).toBeNull();
  });

  it("puts the layer's timecode findings on the segment they are about", () => {
    draw(keyed(seg('Jeg bor i Oslo.', { start: 9, end: 4 }), seg('Hun bor der nå.')));
    const first = screen.getByRole('textbox', { name: 'Segment 1: the sentence' }).closest('li')!;
    expect(within(first).getByText(/ends before it starts/)).toBeInTheDocument();
  });

  it('warns that the key is the answer', () => {
    draw(keyed(seg('En.')));
    expect(screen.getByText('The key is the answer.')).toBeInTheDocument();
  });

  it('has no axe violations, empty, keyed and joined (AC-X6)', async () => {
    const options = { rules: { 'color-contrast': { enabled: false } } };
    const blank = draw(emptyContent('nb'));
    expect((await axe.run(blank.container, options)).violations).toEqual([]);
    blank.unmount();

    const full = draw(
      keyed(
        seg('Jeg bor i Oslo.', { start: 0, end: 4 }),
        seg('Hun bor der nå.', { start: 4, end: 8 }),
      ),
    );
    expect((await axe.run(full.container, options)).violations).toEqual([]);
    await userEvent.click(screen.getByRole('radio', { name: 'One continuous text' }));
    expect((await axe.run(full.container, options)).violations).toEqual([]);
  });
});
