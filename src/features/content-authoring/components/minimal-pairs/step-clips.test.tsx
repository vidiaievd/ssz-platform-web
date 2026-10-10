import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { createMockClipPlayer, type MockClipPlayer } from '@/features/student/exercises/runner';
import { emptyClip, newPair, newWord, type Word } from '@/lib/shared-kernel/minimal-pairs';

import type { MinimalPairsDocument } from './edits';
import { StepClips } from './step-clips';
import {
  blankDocument,
  fakeSources,
  Harness,
  PAGE_RULES,
  sampleMinimalPairs,
  type FakeSources,
} from './test-support';

function renderStep(
  initial: MinimalPairsDocument,
  sources: FakeSources = fakeSources(initial),
  player: MockClipPlayer = createMockClipPlayer(),
) {
  const changes: MinimalPairsDocument[] = [];
  const view = render(
    <Harness
      initial={initial}
      onChange={(next) => changes.push(next)}
      step={(props) => (
        <StepClips
          {...props}
          exerciseId="ex-1"
          teacherVoice="Kari Nordmann"
          sources={sources}
          player={player}
        />
      )}
    />,
  );
  return {
    user: userEvent.setup(),
    sources,
    player,
    changes,
    last: () => changes[changes.length - 1]!,
    ...view,
  };
}

function word(text: string, clip: Partial<Word['clip']> = {}): Word {
  return { ...newWord(text), clip: { ...emptyClip(), ...clip } };
}

/** A set of one pair, `words` as given, in the exercise's family unless `contrastId` says. */
function onePair(words: Word[], contrastId = 'kjsj', pairContrast = ''): MinimalPairsDocument {
  const doc = blankDocument();
  return { ...doc, contrastId, pairs: [{ ...newPair(), contrastId: pairContrast, words }] };
}

const row = (text: string) =>
  screen.getByText(text, { selector: 'b' }).closest('div[class*="rounded"]') as HTMLElement;

describe('StepClips — coverage and rows (MP-B9, MP-B10)', () => {
  it('counts the words with audio', () => {
    const doc = onePair([word('kjære', { assetId: 'a1', durationMs: 700 }), word('skjære')]);
    renderStep(doc);
    expect(screen.getByText('words with audio').previousSibling).toHaveTextContent('1 / 2');
    expect(screen.getByRole('meter', { name: 'Words with audio' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
  });

  it('shows a recorded word with its length, who said it and the voice', async () => {
    renderStep(sampleMinimalPairs());
    const kjaere = row('kjære');
    await waitFor(() => expect(within(kjaere).getByText('0,78 s')).toBeInTheDocument());
    expect(within(kjaere).getByText('Studio')).toBeInTheDocument();
    expect(within(kjaere).getByText('Ingrid (Oslo)')).toBeInTheDocument();
  });

  it('offers the three sources on a word without audio', () => {
    renderStep(onePair([word('kjære'), word('skjære')]));
    const empty = row('kjære');
    expect(within(empty).getByText('no audio')).toBeInTheDocument();
    expect(within(empty).getByRole('button', { name: 'Record' })).toBeEnabled();
    expect(within(empty).getByRole('button', { name: 'Upload a clip for «kjære»' })).toBeEnabled();
  });

  it('removes a clip from the word, keeping who said it', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('button', { name: 'Remove clip of «kjære»' }));
    const kjaere = last().pairs[0]!.words[0]!.clip;
    expect(kjaere.assetId).toBe('');
    expect(kjaere.voice).toBe('Ingrid (Oslo)');
  });

  it('plays a word, and the pair one after the other with «Hear A/B»', async () => {
    const { user, player } = renderStep(sampleMinimalPairs());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play «kjære»' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Play «kjære»' }));
    expect(player.requests[0]).toEqual([{ id: 'w1kjar', url: 'https://minio.test/as_kjære' }]);
    const first = screen.getByRole('region', { name: 'kjære · skjære' });
    await user.click(within(first).getByRole('button', { name: 'Hear A/B' }));
    expect(player.requests[1]!.map((c) => c.id)).toEqual(['w1kjar', 'w2skja']);
  });
});

describe('StepClips — the sources (MP-B11…B13, MP-U1)', () => {
  it('records a word with the microphone and uploads the take as the teacher', async () => {
    const doc = onePair([word('kjære'), word('skjære')]);
    const { user, sources, last } = renderStep(doc);
    await user.click(within(row('kjære')).getByRole('button', { name: 'Record' }));
    expect(sources.mic.calls.start).toBe(1);
    // One microphone: the other word waits.
    expect(within(row('skjære')).getByRole('button', { name: 'Record' })).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Recording «kjære»' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stopp' }));
    await waitFor(() => expect(last().pairs[0]!.words[0]!.clip.assetId).toBe('up-kjære.webm'));
    const [file, owner] = sources.upload.mock.calls[0]!;
    expect(file.type).toBe('audio/webm');
    expect(owner).toBe('ex-1');
    expect(last().pairs[0]!.words[0]!.clip).toMatchObject({
      provenance: 'teacher',
      voice: 'Kari Nordmann',
      durationMs: 0,
    });
  });

  it('says so when the microphone is refused', async () => {
    const sources = fakeSources();
    sources.mic.openWith('denied');
    const { user } = renderStep(onePair([word('kjære'), word('skjære')]), sources);
    await user.click(within(row('kjære')).getByRole('button', { name: 'Record' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed to use the microphone');
  });

  it('uploads a chosen file as a studio clip with no voice name', async () => {
    const { user, sources, last, container } = renderStep(onePair([word('kjære'), word('skjære')]));
    await user.click(screen.getByRole('button', { name: 'Upload a clip for «skjære»' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'skjaere.mp3', { type: 'audio/mpeg' }));
    await waitFor(() => expect(last().pairs[0]!.words[1]!.clip.assetId).toBe('up-skjaere.mp3'));
    expect(sources.upload).toHaveBeenCalledTimes(1);
    expect(last().pairs[0]!.words[1]!.clip).toMatchObject({
      provenance: 'studio',
      voice: '',
      fileName: 'skjaere.mp3',
    });
  });

  it('synthesizes a word and writes the length once the asset is measured', async () => {
    const doc = onePair([word('kjøre'), word('kjøpe')], 'consonant');
    const sources = fakeSources();
    sources.assets['tts-kjøre'] = { status: 'ready', durationMs: 640 };
    const { user, last } = renderStep(doc, sources);
    const tts = within(row('kjøre')).getByRole('button', { name: 'TTS' });
    expect(tts).toHaveAttribute('title', 'Generate with TTS');
    await user.click(tts);
    expect(sources.synthesize).toHaveBeenCalledWith('kjøre', 'nb', 'ex-1');
    await waitFor(() => expect(last().pairs[0]!.words[0]!.clip.durationMs).toBe(640));
    expect(last().pairs[0]!.words[0]!.clip).toMatchObject({
      assetId: 'tts-kjøre',
      provenance: 'tts',
      voice: 'nb_NO-talesyntese',
    });
    expect(within(row('kjøre')).getByText('Syntetisk')).toBeInTheDocument();
  });

  it("turns TTS off by the pair's family, not the exercise's (§4.2 p. 2)", () => {
    const doc = blankDocument();
    doc.contrastId = 'consonant';
    doc.pairs = [
      { ...newPair(), words: [word('vente'), word('vinne')] },
      { ...newPair(), contrastId: 'kjsj', words: [word('kjekk'), word('sjekk')] },
    ];
    renderStep(doc);
    expect(within(row('vente')).getByRole('button', { name: 'TTS' })).toBeEnabled();
    const barred = within(row('kjekk')).getByRole('button', { name: 'TTS' });
    expect(barred).toBeDisabled();
    expect(barred).toHaveAttribute('title', 'Synthesis merges this contrast — not allowed here');
  });

  it('shows an asset still being measured as pending', async () => {
    renderStep(onePair([word('kjære', { assetId: 'slow' }), word('skjære')]));
    expect(await within(row('kjære')).findByRole('status')).toHaveTextContent('Measuring…');
  });
});

describe('StepClips — the checks (MP-B14…B16)', () => {
  it('warns about two voices in a pair and relabels both to one', async () => {
    const doc = onePair([
      word('kjære', { assetId: 'a1', durationMs: 700, voice: 'Ingrid' }),
      word('skjære', { assetId: 'a2', durationMs: 720, provenance: 'teacher', voice: 'Kari' }),
    ]);
    const { user, last } = renderStep(doc);
    expect(screen.getByText(/Two voices in one pair \(Ingrid \/ Kari\)\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use «Ingrid» for both' }));
    expect(last().pairs[0]!.words.map((w) => [w.clip.voice, w.clip.provenance])).toEqual([
      ['Ingrid', 'studio'],
      ['Ingrid', 'studio'],
    ]);
    expect(screen.queryByText(/Two voices in one pair/)).toBeNull();
  });

  it('says when the lengths of a pair are too far apart', () => {
    renderStep(
      onePair([
        word('tak', { assetId: 'a1', durationMs: 400 }),
        word('takk', { assetId: 'a2', durationMs: 900 }),
      ]),
    );
    expect(
      screen.getByText('500 ms apart — length answers the probe before the sound does.'),
    ).toBeInTheDocument();
  });

  it('asks for the dialect of a toneme pair and sets it on every word', async () => {
    const doc = onePair(
      [
        word('bønder', { assetId: 'a1', durationMs: 700 }),
        word('bønner', { assetId: 'a2', durationMs: 700 }),
      ],
      'tone',
    );
    const { user, last } = renderStep(doc);
    expect(screen.getByText(/Without a dialect on every clip/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Vestlandsk' }));
    expect(last().pairs[0]!.words.map((w) => w.clip.dialect)).toEqual(['vest', 'vest']);
    expect(screen.queryByText(/Without a dialect on every clip/)).toBeNull();
  });

  it('does not ask for a dialect outside the toneme family', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.queryByRole('radiogroup', { name: 'Dialect of the recording' })).toBeNull();
  });

  it('states the synthesis policy of the exercise family', () => {
    renderStep(blankDocument());
    const card = screen.getByRole('region', { name: 'Synthetic speech policy' });
    expect(card).toHaveTextContent(/^Synthetic speech policy.*kj \/ sj.*Blocked for this contrast/);
  });

  it('states it per family when the set mixes them', () => {
    renderStep(sampleMinimalPairs());
    const card = screen.getByRole('region', { name: 'Synthetic speech policy' });
    expect(
      within(card)
        .getByText(/^Blocked for this contrast/)
        .closest('p'),
    ).toHaveTextContent(/^kj \/ sj\./);
    expect(
      within(card)
        .getByText(/^Allowed\. Vowel quality/)
        .closest('p'),
    ).toHaveTextContent(/^Konsonant\./);
  });

  it('opens and closes the slice panel', async () => {
    const { user } = renderStep(blankDocument());
    await user.click(screen.getByRole('button', { name: 'Slice one file' }));
    expect(screen.getByText(/Studio session in one file\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Studio session in one file\./)).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderStep(sampleMinimalPairs());
    await waitFor(() => expect(screen.getAllByText('Studio').length).toBeGreaterThan(0));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});
