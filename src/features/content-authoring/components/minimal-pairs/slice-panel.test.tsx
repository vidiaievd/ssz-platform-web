import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { emptyClip, newPair, newWord, type Word } from '@/lib/shared-kernel/minimal-pairs';

import type { MinimalPairsDocument } from './edits';
import type { DecodedAudio } from './slice';
import { SlicePanel } from './slice-panel';
import { blankDocument, fakeSources, Harness, PAGE_RULES, type FakeSources } from './test-support';

const RATE = 8000;

/** A session of tone bursts over a quiet floor, one per `[from, to]`. */
function session(totalMs: number, words: [number, number][]): DecodedAudio {
  const samples = new Float32Array(Math.round((totalMs / 1000) * RATE));
  for (let i = 0; i < samples.length; i++) samples[i] = (i % 7) * 0.0005;
  for (const [from, to] of words) {
    for (let i = (from / 1000) * RATE; i < (to / 1000) * RATE; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / RATE);
    }
  }
  return { samples, sampleRate: RATE };
}

function word(text: string, assetId = ''): Word {
  return { ...newWord(text), clip: { ...emptyClip(), assetId, durationMs: assetId ? 700 : 0 } };
}

/** kjære / skjære without audio, kjekk recorded, sjekk without — three words to cut into. */
function doc(): MinimalPairsDocument {
  const d = blankDocument();
  d.pairs = [
    { ...newPair(), words: [word('kjære'), word('skjære')] },
    { ...newPair(), words: [word('kjekk', 'have'), word('sjekk')] },
  ];
  return d;
}

function renderPanel(initial: MinimalPairsDocument, sources: FakeSources = fakeSources(initial)) {
  const changes: MinimalPairsDocument[] = [];
  const onClose = vi.fn();
  const view = render(
    <Harness
      initial={initial}
      onChange={(next) => changes.push(next)}
      step={(props) => (
        <SlicePanel {...props} exerciseId="ex-1" sources={sources} onClose={onClose} />
      )}
    />,
  );
  return {
    user: userEvent.setup(),
    sources,
    onClose,
    changes,
    last: () => changes[changes.length - 1]!,
    ...view,
  };
}

async function drop(container: HTMLElement, sources: FakeSources, audio: DecodedAudio) {
  sources.decode.mockResolvedValueOnce(audio);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, new File(['x'], 'opptak-kj-sj.wav', { type: 'audio/wav' }));
}

describe('SlicePanel — one session, one clip per word (Q3-A, MP-U2)', () => {
  it('waits for a file, then marks a region per word without audio', async () => {
    const { container, sources } = renderPanel(doc());
    expect(screen.getByText('Drop the session file here')).toBeInTheDocument();
    await drop(
      container,
      sources,
      session(4000, [
        [300, 900],
        [1500, 2100],
        [2700, 3300],
      ]),
    );

    expect(
      await screen.findByText('opptak-kj-sj.wav · 0:04 · 3 regions detected by silence'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Region 1 — kjære' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Region 3 — sjekk' })).toBeInTheDocument();
    expect(screen.getByText(/in pair order: kjære · skjære · sjekk\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cut into 3 clips' })).toBeEnabled();
  });

  it('cuts one WAV per region and attaches it as a studio clip voiced by the session', async () => {
    const { container, sources, last, onClose, user } = renderPanel(doc());
    await drop(
      container,
      sources,
      session(4000, [
        [300, 900],
        [1500, 2100],
        [2700, 3300],
      ]),
    );
    await user.click(await screen.findByRole('button', { name: 'Cut into 3 clips' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sources.upload.mock.calls.map(([f]) => [f.name, f.type])).toEqual([
      ['kjære.wav', 'audio/wav'],
      ['skjære.wav', 'audio/wav'],
      ['sjekk.wav', 'audio/wav'],
    ]);
    const clips = last().pairs.flatMap((p) =>
      p.words.map((w) => [w.text, w.clip.assetId, w.clip.voice]),
    );
    expect(clips).toEqual([
      ['kjære', 'up-kjære.wav', 'opptak-kj-sj.wav'],
      ['skjære', 'up-skjære.wav', 'opptak-kj-sj.wav'],
      ['kjekk', 'have', ''],
      ['sjekk', 'up-sjekk.wav', 'opptak-kj-sj.wav'],
    ]);
  });

  it('keeps the regions whose upload failed for a second cut', async () => {
    const sources = fakeSources();
    sources.upload.mockImplementation((file: File) =>
      file.name === 'skjære.wav'
        ? Promise.reject(new Error('down'))
        : Promise.resolve(`up-${file.name}`),
    );
    const { container, onClose, user } = renderPanel(doc(), sources);
    await drop(
      container,
      sources,
      session(4000, [
        [300, 900],
        [1500, 2100],
        [2700, 3300],
      ]),
    );
    await user.click(await screen.findByRole('button', { name: 'Cut into 3 clips' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('1 clip could not be uploaded');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Region 1 — skjære' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cut into 1 clip' })).toBeEnabled();
  });

  it('moves an edge with the arrow keys', async () => {
    const { container, sources, user } = renderPanel(doc());
    await drop(
      container,
      sources,
      session(4000, [
        [300, 900],
        [1500, 2100],
        [2700, 3300],
      ]),
    );
    const end = await screen.findByRole('slider', { name: 'End of region 1' });
    const before = Number(end.getAttribute('aria-valuenow'));
    end.focus();
    await user.keyboard('{ArrowRight}{Shift>}{ArrowRight}{/Shift}');
    expect(
      Number(screen.getByRole('slider', { name: 'End of region 1' }).getAttribute('aria-valuenow')),
    ).toBe(before + 60);
  });

  it('says so when the file is not audio', async () => {
    const { container, sources } = renderPanel(doc());
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'notes.wav', { type: 'audio/wav' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not read this file as audio');
    expect(sources.decode).toHaveBeenCalledTimes(1);
  });

  it('takes a dropped file too', async () => {
    const { sources } = renderPanel(doc());
    sources.decode.mockResolvedValueOnce(session(2000, [[300, 900]]));
    const zone = screen.getByText('Drop the session file here').parentElement!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(['x'], 'one.wav', { type: 'audio/wav' })] },
    });
    expect(await screen.findByText(/one\.wav · 0:02 · 1 region detected/)).toBeInTheDocument();
  });

  it('has nothing to cut into when every word has audio', () => {
    const full = blankDocument();
    full.pairs = [{ ...newPair(), words: [word('kjekk', 'a'), word('sjekk', 'b')] }];
    renderPanel(full);
    expect(screen.getByText(/Every word already has audio/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeDisabled();
  });

  it('has no axe violations with regions on screen', async () => {
    const { container, sources } = renderPanel(doc());
    await drop(
      container,
      sources,
      session(4000, [
        [300, 900],
        [1500, 2100],
        [2700, 3300],
      ]),
    );
    await screen.findAllByRole('slider');
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    expect(within(container).getAllByRole('slider')).toHaveLength(6);
  });
});
