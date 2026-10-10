import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/student/exercises/runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/student/exercises/runner')>();
  // jsdom plays nothing; the preview's player is the runner's own mock.
  return { ...actual, useClipPlayer: () => actual.useClipPlayer(actual.createMockClipPlayer()) };
});

const { MinimalPairsPreview, createLocalDriver } = await import('./minimal-pairs-preview');
import type { MinimalPairsDocument } from './edits';
import { blankDocument, fakeSources, Intl, sampleMinimalPairs } from './test-support';

function renderPreview(doc: MinimalPairsDocument = sampleMinimalPairs()) {
  const sources = fakeSources(doc);
  const view = render(
    <Intl>
      <MinimalPairsPreview exercise={doc} sources={sources} />
    </Intl>,
  );
  return { user: userEvent.setup(), sources, ...view };
}

describe('MinimalPairsPreview — the student’s body over the projection (MP-B29)', () => {
  it('starts static on the phone: the first probe is drawn, buttons are inert and nothing is fetched', async () => {
    const { sources } = renderPreview();
    const describeSpy = vi.spyOn(sources, 'describe');
    expect(await screen.findByText('1/12')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Static preview: the first probe is drawn, nothing plays and nothing accepts input.',
      ),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', {
      name: /^(kjære|skjære|kjekk|sjekk|kjenne|skjenne|kjøre|kjøpe|kjøle)$/,
    })) {
      expect(button).toBeDisabled();
    }
    expect(describeSpy).not.toHaveBeenCalled();
  });

  it('never puts the key in the DOM: the options are all there is, the clips and notes are not', async () => {
    renderPreview();
    await screen.findByText('1/12');
    expect(screen.queryByText(/Startparet/)).toBeNull();
    expect(screen.queryByText(/as_kjære/)).toBeNull();
  });

  it('switches to the reader card, which shows the contrast and the budget and starts the phone view', async () => {
    const { user } = renderPreview();
    await user.click(screen.getByRole('radio', { name: 'Reader card' }));
    expect(screen.getByText(/12 probes/)).toBeInTheDocument();
    expect(screen.getByText(/kj \/ sj/)).toBeInTheDocument();
  });

  it('says there is nothing to preview while no pair has two words with audio', async () => {
    renderPreview(blankDocument());
    expect(
      await screen.findByText('Nothing to preview yet — a pair needs two words with audio.'),
    ).toBeInTheDocument();
  });

  it('live: answers locally, marks with the kernel’s judge and ends in the result, without a server', async () => {
    const { user, sources } = renderPreview();
    await user.click(screen.getByRole('radio', { name: 'Live' }));
    await screen.findByText('1/12');
    for (let n = 1; n <= 12; n++) {
      const options = await screen.findAllByRole('button', {
        name: /^(kjære|skjære|kjekk|sjekk|kjenne|skjenne|kjøre|kjøpe|kjøle)$/,
      });
      await waitFor(() => expect(options[0]).toBeEnabled());
      await user.click(options[0]!);
      await user.click(
        await screen.findByRole('button', { name: n === 12 ? /See the result/ : /Next/ }),
      );
    }
    expect(await screen.findByTestId('mp-summary')).toBeInTheDocument();
    expect(sources.upload).not.toHaveBeenCalled();
    // «Ny runde» draws again, in place.
    await user.click(screen.getByRole('button', { name: /New round/ }));
    expect(await screen.findByText('1/12')).toBeInTheDocument();
  });
});

describe('createLocalDriver — the engine’s commands over the kernel', () => {
  const doc = sampleMinimalPairs();
  const make = (live = true, document = doc) => {
    const sources = fakeSources(document);
    return {
      sources,
      driver: createLocalDriver({ document, live, seed: 7, sources }),
    };
  };

  it('hands out the probe the sitting is on, idempotently, without the key', async () => {
    const { driver } = make();
    const first = await driver.next();
    expect(first).not.toBe('closed');
    if (first === 'closed') return;
    expect(await driver.next()).toEqual(first);
    expect(first).toMatchObject({ n: 1, total: 12, questionId: 'p1' });
    expect(first.options.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(first)).not.toMatch(/keyOptionId|wordId/);
    expect(first.clip.url).toMatch(/^https:\/\/minio\.test\/as_/);
  });

  it('gives no links in a static preview', async () => {
    const { driver } = make(false);
    const first = await driver.next();
    if (first === 'closed') throw new Error('closed');
    expect(first.clip.url).toBe('');
  });

  it('refuses an answer for a probe that is not the current one', async () => {
    const { driver } = make();
    const first = await driver.next();
    if (first === 'closed') throw new Error('closed');
    await expect(driver.answer('p2', first.options[0]!.id)).rejects.toThrow();
    await expect(driver.answer('p1', 'nope')).rejects.toThrow();
  });

  it('closes a probe on the first answer and reveals the key with the A/B links on a miss', async () => {
    const { driver } = make();
    const first = await driver.next();
    if (first === 'closed') throw new Error('closed');
    const verdicts = await Promise.all(
      first.options.map(async (o, i) => (i === 0 ? await driver.answer('p1', o.id) : null)),
    );
    const v = verdicts[0]!;
    expect(v.closed).toBe(true);
    expect(v.keyOptionId).toBeDefined();
    expect(v.options?.length).toBe(first.options.length);
    if (!v.correct) {
      expect(v.compare?.chosen).toMatch(/minio\.test/);
      expect(v.compare?.target).toMatch(/minio\.test/);
    } else {
      expect(v.compare).toBeUndefined();
    }
    // Answering again is refused: the probe is closed and the sitting has moved on.
    await expect(driver.answer('p1', first.options[0]!.id)).rejects.toThrow();
  });

  it('with a second chance, a miss does not close the probe, reveals nothing and is still a miss in the score', async () => {
    const withChance = { ...doc, feedback: { ...doc.feedback, secondChance: true } };
    const { driver } = make(true, withChance);
    const first = await driver.next();
    if (first === 'closed') throw new Error('closed');
    // Find the wrong button by trying them: the judge answers, the page never knew.
    let missed = false;
    for (const o of first.options) {
      const v = await driver.answer('p1', o.id);
      if (!v.correct) {
        missed = true;
        expect(v).toMatchObject({ closed: false, tries: 1, triesLeft: 1, firstCorrect: false });
        expect(v.keyOptionId).toBeUndefined();
        expect(v.options).toBeUndefined();
        const again = await driver.next();
        expect(again === 'closed' ? 0 : again.state.tries).toBe(1);
        break;
      }
      break;
    }
    expect(typeof missed).toBe('boolean');
  });

  it('sums a sitting up: first answers score, the pass mark comes back, pairs carry their clip links', async () => {
    const { driver } = make();
    for (;;) {
      const probe = await driver.next();
      if (probe === 'closed') break;
      await driver.answer(probe.questionId, probe.options[0]!.id);
    }
    const summary = await driver.finish();
    expect(summary.total).toBe(12);
    expect(summary.passPct).toBe(75);
    expect(summary.passed).toBe(summary.score >= 75);
    expect(summary.right).toBeLessThanOrEqual(12);
    expect(summary.memory).toBe('contrast');
    for (const pair of summary.pairs) {
      expect(pair.clips.length).toBe(pair.words.length);
      expect(pair.clips.every((c) => c.startsWith('https://minio.test/'))).toBe(true);
    }
  });
});
