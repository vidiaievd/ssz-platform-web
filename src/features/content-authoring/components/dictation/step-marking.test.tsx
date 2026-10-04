import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, newSegment, type DictationContent } from '@/lib/shared-kernel/dictation';

import { StepMarking } from './step-marking';

function Harness({
  initial,
  spy,
  back,
}: {
  initial: DictationContent;
  spy: (ex: DictationContent) => void;
  back?: () => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepMarking
      exercise={ex}
      onBackToKey={back}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: DictationContent, back?: () => void) {
  const spy = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} back={back} />
    </NextIntlClientProvider>,
  );
  return { ...view, spy, last: () => spy.mock.calls.at(-1)?.[0] as DictationContent };
}

const SEG_ID = 'seg1';

function keyed(patch: Partial<DictationContent> = {}): DictationContent {
  const base = emptyContent('nb');
  return {
    ...base,
    segments: [{ ...newSegment(), id: SEG_ID, text: 'Jeg hørte kjøkkenet i går.' }],
    ...patch,
  };
}

const pick = (word: string) => screen.getByRole('button', { name: word });
const AXE = { rules: { 'color-contrast': { enabled: false } } };

describe('StepMarking', () => {
  it('has nothing to mark without a key, and sends the author back to it', async () => {
    const back = vi.fn();
    draw(emptyContent('nb'), back);
    expect(screen.getByText('Nothing written down yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to the key' }));
    expect(back).toHaveBeenCalledOnce();
  });

  it('marks a word on a click and unmarks it on the next — dashed until it has a reason (AC-B6)', async () => {
    const { last } = draw(keyed());
    const word = pick('kjøkkenet');
    expect(word).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(word);
    expect(last().segments[0]!.focus).toMatchObject([{ wordIndex: 2, why: '' }]);
    expect(pick('kjøkkenet')).toHaveAttribute('aria-pressed', 'true');
    expect(pick('kjøkkenet')).toHaveAttribute('data-silent', 'true');
    expect(pick('kjøkkenet')).toHaveAttribute('title', 'No reason written yet');

    await userEvent.type(
      screen.getByLabelText('Why “kjøkkenet” is spelled that way'),
      'kj, not sj',
    );
    expect(pick('kjøkkenet')).not.toHaveAttribute('data-silent');
    expect(pick('kjøkkenet')).toHaveAttribute('title', 'kj, not sj');

    await userEvent.click(pick('kjøkkenet'));
    expect(last().segments[0]!.focus).toEqual([]);
  });

  it('counts the focus words that explain themselves', async () => {
    draw(keyed());
    expect(screen.getByText('Click the words below that this dictation is about.')).toBeVisible();

    await userEvent.click(pick('kjøkkenet'));
    await userEvent.click(pick('hørte'));
    expect(screen.getByText('0 / 2 focus words with a reason')).toBeInTheDocument();
    expect(screen.getByText('2 of them are marked but silent.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Why “hørte” is spelled that way'), 'ø');
    await userEvent.type(screen.getByLabelText('Why “kjøkkenet” is spelled that way'), 'kj');
    expect(screen.getByText('2 / 2 focus words with a reason')).toBeInTheDocument();
    expect(screen.getByText('Every focus word explains itself.')).toBeInTheDocument();
  });

  it('writes the rules into the marking, and says what «half a word» costs', async () => {
    const { last } = draw(keyed());
    await userEvent.click(screen.getByRole('switch', { name: /Capital letters count/ }));
    expect(last().marking.caseSensitive).toBe(true);
    await userEvent.click(screen.getByRole('switch', { name: /Punctuation counts/ }));
    expect(last().marking.punctuation).toBe(true);

    expect(screen.getByRole('radio', { name: 'Wrong, named' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Half a word' }));
    expect(last().marking.near).toBe('half');
    expect(screen.getByText(/earns half a word/)).toHaveAttribute('data-tone', 'warn');
    await userEvent.click(screen.getByRole('radio', { name: 'Wrong' }));
    expect(last().marking.near).toBe('strict');
  });

  it('grades a student answer with the rules above and stores nothing (AC-B8)', async () => {
    const { spy } = draw(keyed());
    const panel = screen.getByRole('region', { name: 'Try a student answer' });
    const field = within(panel).getByRole('textbox');
    const result = within(panel).getByTestId('dc-try-result');

    await userEvent.clear(field);
    await userEvent.type(field, 'Jeg hørte kjøkkenet');
    expect(result.querySelectorAll('[data-s="miss"]')).toHaveLength(2);
    expect(result).toHaveTextContent('60%');

    // Capitals are off: the line is the same for «jeg» as for «Jeg»…
    await userEvent.clear(field);
    await userEvent.type(field, 'jeg hørte kjøkkenet i går');
    expect(result).toHaveTextContent('100%');
    expect(result.querySelector('[data-s="near"], [data-s="wrong"]')).toBeNull();

    // …and the rule above changes it at once.
    await userEvent.click(screen.getByRole('switch', { name: /Capital letters count/ }));
    expect(result.querySelector('[data-s="near"], [data-s="wrong"]')).not.toBeNull();

    // Typing in the panel never reached the document; only the switch did.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps a marked word «wrong», never «almost right» (DECISIONS §5)', async () => {
    draw(keyed({ marking: { ...keyed().marking, near: 'half' } }));
    const panel = screen.getByRole('region', { name: 'Try a student answer' });
    const field = within(panel).getByRole('textbox');
    const result = within(panel).getByTestId('dc-try-result');

    await userEvent.clear(field);
    await userEvent.type(field, 'Jeg hørte kjøkkenat i går');
    expect(result.querySelector('[data-s="near"]')).not.toBeNull();

    await userEvent.click(pick('kjøkkenet'));
    expect(result.querySelector('[data-s="near"]')).toBeNull();
    expect(result.querySelector('[data-s="wrong"]')).toHaveAttribute('data-focus', 'true');
  });

  it('keeps a word an edit removed in a panel until it is put back or dropped (AC-B7)', async () => {
    const base = keyed();
    const { last } = draw({
      ...base,
      orphans: [
        { id: 'o1', segmentId: SEG_ID, surface: 'kjøkkenet', why: 'kj' },
        { id: 'o2', segmentId: SEG_ID, surface: 'badet', why: '' },
      ],
    });
    const panel = screen.getByRole('region', { name: /2 marked words lost their place/ });
    expect(within(panel).getByText('that word is gone')).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole('button', { name: 'Put it back' }));
    expect(last().segments[0]!.focus).toMatchObject([{ id: 'o1', wordIndex: 2, why: 'kj' }]);
    expect(last().orphans.map((o) => o.id)).toEqual(['o2']);

    await userEvent.click(screen.getByRole('button', { name: 'Drop the mark on “badet”' }));
    expect(last().orphans).toEqual([]);
    expect(screen.queryByText('that word is gone')).toBeNull();
  });

  it('requires the line to say when a sentence comes back wrong, and takes it (AC-B5)', async () => {
    const { last } = draw(keyed());
    const field = screen.getByLabelText(/What to say when the sentence comes back wrong/);
    expect(field).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Required — a dictation that answers only “wrong” teaches copying.',
    );

    await userEvent.type(field, 'Say it aloud.');
    expect(last().segments[0]!.why).toBe('Say it aloud.');
    expect(screen.getByLabelText(/What to say when/)).toBeValid();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows only sentences that are written', () => {
    draw(keyed({ segments: [...keyed().segments, newSegment()] }));
    expect(screen.getAllByRole('region', { name: /^Segment \d+$/ })).toHaveLength(1);
  });

  it('has no axe violations (AC-X6)', async () => {
    const base = keyed();
    const view = draw({
      ...base,
      segments: [
        {
          ...base.segments[0]!,
          focus: [{ id: 'f1', wordIndex: 2, why: '' }],
        },
      ],
      orphans: [{ id: 'o1', segmentId: SEG_ID, surface: 'badet', why: '' }],
    });
    expect((await axe.run(view.container, AXE)).violations).toEqual([]);
  });
});
