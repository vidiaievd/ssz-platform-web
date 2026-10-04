import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type DictationContent } from '@/lib/shared-kernel/dictation';

import { StepRecording } from './step-recording';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function Harness({
  initial,
  spy,
}: {
  initial: DictationContent;
  spy: (ex: DictationContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepRecording
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: DictationContent) {
  const spy = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness initial={initial} spy={spy} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...view, spy, last: () => spy.mock.calls.at(-1)?.[0] as DictationContent };
}

const withAudio = (patch: Record<string, unknown>): DictationContent => {
  const base = emptyContent('nb');
  return { ...base, audio: { ...base.audio, ...patch } };
};

describe('StepRecording', () => {
  it('shows the missing clip as a blocker on a new exercise (AC-B1)', () => {
    draw(emptyContent('nb'));
    const blockers = screen
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('data-level') === 'blocker')
      .map((li) => li.textContent);
    expect(blockers).toEqual([
      'The exercise has no title — teachers cannot find it in the module.',
      'Listening is on but nothing is attached to play.',
    ]);
  });

  it('drops the blockers as they are written, and warns about an unnamed clip', async () => {
    const { last } = draw(withAudio({ source: 'link', url: 'https://example.com/a.mp3' }));
    expect(screen.queryByText('Listening is on but nothing is attached to play.')).toBeNull();

    await userEvent.type(screen.getByLabelText(/Exercise title/), 'Diktat');
    expect(last().title).toBe('Diktat');
    expect(
      screen.queryByText('The exercise has no title — teachers cannot find it in the module.'),
    ).toBeNull();
    const warning = screen
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('data-level') === 'warning');
    expect(warning).toHaveTextContent(/The clip has no title/);
  });

  it('writes the standing instruction, in the reading face', async () => {
    const { last } = draw(emptyContent('nb'));
    const field = screen.getByLabelText('Instruction above the field');
    expect(field).toHaveStyle({ fontFamily: 'var(--ssz-font-reading)' });
    await userEvent.type(field, 'Skriv.');
    expect(last().instruction).toBe('Skriv.');
  });

  it('has no switch for listening — it is always on', () => {
    draw(emptyContent('nb'));
    expect(screen.queryByRole('switch', { name: /Listening exercise/ })).toBeNull();
    expect(screen.getByText('The clip')).toBeInTheDocument();
  });

  it('keeps listening on whatever the source card writes', async () => {
    const { last } = draw(emptyContent('nb'));
    await userEvent.click(screen.getByRole('radio', { name: 'Link' }));
    await userEvent.type(screen.getByLabelText('Address of the clip'), 'https://x.test/a.mp3');
    expect(last().audio).toMatchObject({ source: 'link', enabled: true });
  });

  it('plays a simulated clip for the author while no file is attached, and says so (Q7-A)', () => {
    draw(withAudio({ duration: 42 }));
    const card = screen.getByRole('region', { name: 'Listen to it yourself' });
    expect(card).toHaveTextContent('simulated clip — silent, as long as the length you entered');
    // The player is the layer's, with no allowance spent: nothing about listens left.
    expect(within(card).getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(card.querySelector('audio')?.getAttribute('src')).toMatch(/^data:audio\/wav/);
  });

  it('says it is the real player once a clip is attached', () => {
    draw(withAudio({ source: 'link', url: 'https://x.test/a.mp3', duration: 42 }));
    const card = screen.getByRole('region', { name: 'Listen to it yourself' });
    expect(card).toHaveTextContent("the author's player — no limits apply here");
    expect(card.querySelector('audio')?.getAttribute('src')).toBe('https://x.test/a.mp3');
  });

  it('has no axe violations, blank and with a clip (AC-X6)', async () => {
    const blank = draw(emptyContent('nb'));
    expect(
      (await axe.run(blank.container, { rules: { 'color-contrast': { enabled: false } } }))
        .violations,
    ).toEqual([]);
    blank.unmount();

    const full = draw(withAudio({ source: 'link', url: 'https://x.test/a.mp3', title: 'T' }));
    expect(
      (await axe.run(full.container, { rules: { 'color-contrast': { enabled: false } } }))
        .violations,
    ).toEqual([]);
  });
});
