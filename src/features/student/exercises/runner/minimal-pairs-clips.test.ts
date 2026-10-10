import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserClipPlayer,
  createMockClipPlayer,
  SEQUENCE_GAP_MS,
} from './minimal-pairs-clips';

/** An element that plays when told to, ends when the test says, or refuses like autoplay policy. */
class FakeAudio extends EventTarget {
  static made: FakeAudio[] = [];
  static refuse = false;
  paused = true;
  duration = 0.7;
  constructor(readonly src: string) {
    super();
    FakeAudio.made.push(this);
  }
  play(): Promise<void> {
    if (FakeAudio.refuse) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {}
  end() {
    this.paused = true;
    this.dispatchEvent(new Event('ended'));
  }
}

const make = (url: string) => new FakeAudio(url) as unknown as HTMLAudioElement;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudio.made = [];
  FakeAudio.refuse = false;
});
afterEach(() => vi.useRealTimers());

describe('createBrowserClipPlayer', () => {
  it('plays one clip, says which is sounding, and goes quiet when it ends', async () => {
    const player = createBrowserClipPlayer(make);
    const seen: Array<string | null> = [];
    player.subscribe(() => seen.push(player.current()));

    await expect(player.play({ id: 'probe', url: 'a.mp3' })).resolves.toBe('played');
    expect(player.current()).toBe('probe');

    FakeAudio.made[0]!.end();
    expect(player.current()).toBeNull();
    expect(seen).toEqual(['probe', null]);
  });

  it('answers a refusal as `refused`, not as an error, and stays quiet', async () => {
    FakeAudio.refuse = true;
    const player = createBrowserClipPlayer(make);

    await expect(player.play({ id: 'probe', url: 'a.mp3' })).resolves.toBe('refused');
    expect(player.current()).toBeNull();
  });

  it('plays a sequence back to back with the gap between', async () => {
    const player = createBrowserClipPlayer(make);
    void player.sequence([
      { id: 'w1', url: 'a.mp3' },
      { id: 'w2', url: 'b.mp3' },
    ]);
    await flush();
    expect(player.current()).toBe('w1');

    FakeAudio.made[0]!.end();
    expect(player.current()).toBeNull();
    await vi.advanceTimersByTimeAsync(SEQUENCE_GAP_MS - 1);
    expect(FakeAudio.made).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(player.current()).toBe('w2');
    expect(FakeAudio.made[1]!.src).toBe('b.mp3');
  });

  it('ends an A/B whose first half is refused rather than playing the second alone', async () => {
    FakeAudio.refuse = true;
    const player = createBrowserClipPlayer(make);

    await expect(
      player.sequence([
        { id: 'w1', url: 'a.mp3' },
        { id: 'w2', url: 'b.mp3' },
      ]),
    ).resolves.toBe('refused');
    await vi.advanceTimersByTimeAsync(SEQUENCE_GAP_MS * 2);
    expect(FakeAudio.made).toHaveLength(1);
    expect(player.current()).toBeNull();
  });

  it('skips a clip with no link — a word media-service could not sign', async () => {
    const player = createBrowserClipPlayer(make);
    void player.sequence([
      { id: 'p:0', url: '' },
      { id: 'p:1', url: 'b.mp3' },
    ]);
    await flush();
    expect(player.current()).toBe('p:1');
    expect(FakeAudio.made.map((a) => a.src)).toEqual(['b.mp3']);
  });

  it('silences what was playing when another clip starts, and on stop', async () => {
    const player = createBrowserClipPlayer(make);
    void player.play({ id: 'w1', url: 'a.mp3' });
    await flush();
    void player.play({ id: 'w2', url: 'b.mp3' });
    await flush();

    expect(FakeAudio.made[0]!.paused).toBe(true);
    // The first one ending late changes nothing: it belongs to a run that is over.
    FakeAudio.made[0]!.end();
    expect(player.current()).toBe('w2');

    player.stop();
    expect(FakeAudio.made[1]!.paused).toBe(true);
    expect(player.current()).toBeNull();
  });

  it('calls a stalled clip over once its length and a grace have passed', async () => {
    const player = createBrowserClipPlayer(make);
    void player.play({ id: 'probe', url: 'a.mp3' });
    await flush();
    expect(player.current()).toBe('probe');

    await vi.advanceTimersByTimeAsync(700 + 4000);
    expect(player.current()).toBeNull();
  });
});

describe('createMockClipPlayer', () => {
  it('records what was asked, refuses once on request, and ends on cue', async () => {
    const player = createMockClipPlayer();
    player.refuseNext();
    await expect(player.play({ id: 'probe', url: 'a' })).resolves.toBe('refused');
    await expect(
      player.sequence([
        { id: 'w1', url: 'a' },
        { id: 'w2', url: 'b' },
      ]),
    ).resolves.toBe('played');
    expect(player.current()).toBe('w1');
    player.end();
    expect(player.current()).toBe('w2');
    player.end();
    expect(player.current()).toBeNull();
    expect(player.requests).toHaveLength(2);
  });
});
