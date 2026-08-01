'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useMediaAsset } from '@/features/media';

/**
 * Where a word's pronunciation comes from. `none` means the button must not be
 * rendered at all: no recording exists and this browser has no voice for the
 * language, so a play control would be a promise the app cannot keep.
 */
export type WordAudioSource = 'recording' | 'synthesis' | 'none';

export interface UseWordAudioResult {
  play: () => void;
  playing: boolean;
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
 * An authored recording always wins; speech synthesis is the fallback, which
 * today is the only branch that fires — no vocabulary item in the seeded
 * courses carries a pronunciation clip yet. Pre-generating those later needs no
 * change here: the recording branch simply starts winning as the ids appear.
 */
export function useWordAudio(
  word: string,
  mediaId?: string,
  lang = 'nb-NO',
): UseWordAudioResult {
  const asset = useMediaAsset(mediaId);
  const hasVoice = useHasVoiceFor(lang);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const url = asset.data?.url;

  const source: WordAudioSource = url ? 'recording' : hasVoice ? 'synthesis' : 'none';

  // A word change while something is still playing must not leave the previous
  // word's audio running under the new card.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      setPlaying(false);
    };
  }, [word, url]);

  const play = useCallback(() => {
    if (url) {
      // A fresh element per tap rather than a rewound cached one: replaying by
      // mutating the element the cleanup effect holds is exactly what the
      // compiler's immutability rule forbids, and restarting is what a tap on a
      // one-word clip means anyway.
      const previous = audioRef.current;
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audioRef.current = audio;
      previous?.pause();
      // A rejected play() (autoplay policy, decode failure) must not strand the
      // button in a permanent "playing" state.
      audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
      return;
    }

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
  }, [url, word, lang, hasVoice]);

  return { play, playing, source };
}
