'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useMediaAsset } from '@/features/media';

/**
 * Where a word's pronunciation comes from. There is no "none": the platform
 * synthesizes server-side, so a play control is always a promise the app can
 * keep — which it was not while this depended on whatever voices the visitor's
 * OS happened to ship. A local voice still speaks if the server is unreachable,
 * but that is a runtime fallback, not a source a caller can plan around.
 */
export type WordAudioSource = 'recording' | 'server';

export interface UseWordAudioResult {
  play: () => void;
  playing: boolean;
  /** True while the server clip for this word is being fetched or synthesized. */
  pending: boolean;
  source: WordAudioSource;
}

/**
 * Norwegian is written in two standards and tagged three ways in the wild
 * (`nb`, `nn`, `no`), and a voice advertising any of them can pronounce a
 * Bokmål word. Matching on the exact tag would reject a perfectly usable
 * `no-NO` voice, which is the common one on Windows.
 */
const LANGUAGE_FAMILIES: string[][] = [['nb', 'nn', 'no']];

function primarySubtag(tag: string) {
  return tag.toLowerCase().split(/[-_]/)[0] ?? '';
}

function sameLanguage(a: string, b: string) {
  const [x, y] = [primarySubtag(a), primarySubtag(b)];
  if (x === y) return true;
  return LANGUAGE_FAMILIES.some((family) => family.includes(x) && family.includes(y));
}

/**
 * Server clips are immutable per word, so the URL is worth keeping for the whole
 * session — module scope rather than component state, because the same word
 * appears on a card, in the list and in the text, each with its own hook.
 */
const serverClips = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

async function fetchServerClip(word: string, lang: string): Promise<string | null> {
  const key = `${lang}|${word}`;
  const cached = serverClips.get(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch('/api/media/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word, lang }),
      });
      if (!res.ok) return null;
      const { url } = (await res.json()) as { url: string };
      serverClips.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

/**
 * Reads the voice list, which Chrome populates asynchronously: the first
 * `getVoices()` after load returns an empty array and only the `voiceschanged`
 * event says otherwise. Treating that first empty array as "no voices" is what
 * makes a synthesis button flicker or never appear.
 */
function useHasVoiceFor(lang: string) {
  const [hasVoice, setHasVoice] = useState(false);

  useEffect(() => {
    // Also the SSR guard: the first client render must match the server's
    // `false`, so this can never be seeded from a lazy initializer.
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    const check = () => setHasVoice(synth.getVoices().some((v) => sameLanguage(v.lang, lang)));

    check();
    synth.addEventListener('voiceschanged', check);
    return () => synth.removeEventListener('voiceschanged', check);
  }, [lang]);

  return hasVoice;
}

/**
 * One play control for a single word, backed by whatever this deployment
 * actually has.
 *
 * An authored recording always wins. Otherwise the clip comes from the
 * platform's own synthesis service, so every learner hears the same voice
 * regardless of their browser — a snap-confined Chromium and a Firefox without
 * speech-dispatcher both see no local voices at all. A local voice is only used
 * when the server cannot be reached, where it beats silence.
 */
export function useWordAudio(
  word: string,
  mediaId?: string,
  lang = 'nb-NO',
): UseWordAudioResult {
  const asset = useMediaAsset(mediaId);
  const hasVoice = useHasVoiceFor(lang);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const url = asset.data?.url;

  const source: WordAudioSource = url ? 'recording' : 'server';

  // A word change while something is still playing must not leave the previous
  // word's audio running under the new card.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      setPlaying(false);
      setPending(false);
    };
  }, [word, url]);

  const playUrl = useCallback((src: string) => {
    // A fresh element per tap rather than a rewound cached one: replaying by
    // mutating the element the cleanup effect holds is exactly what the
    // compiler's immutability rule forbids, and restarting is what a tap on a
    // one-word clip means anyway.
    const previous = audioRef.current;
    const audio = new Audio(src);
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    previous?.pause();
    // A rejected play() (autoplay policy, decode failure) must not strand the
    // button in a permanent "playing" state.
    audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, []);

  const speakLocally = useCallback(() => {
    if (!hasVoice || typeof window === 'undefined' || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    // Chrome queues utterances rather than replacing them, so repeated taps
    // would otherwise pile up and speak the word several times over.
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    const voice = synth.getVoices().find((v) => sameLanguage(v.lang, lang));
    if (voice) utterance.voice = voice;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);

    setPlaying(true);
    synth.speak(utterance);
  }, [hasVoice, lang, word]);

  const play = useCallback(() => {
    if (url) {
      playUrl(url);
      return;
    }

    const cached = serverClips.get(`${lang}|${word}`);
    if (cached) {
      playUrl(cached);
      return;
    }

    setPending(true);
    void fetchServerClip(word, lang).then((clip) => {
      setPending(false);
      if (clip) playUrl(clip);
      else speakLocally();
    });
  }, [url, word, lang, playUrl, speakLocally]);

  return { play, playing, pending, source };
}
