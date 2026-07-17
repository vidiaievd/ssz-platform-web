'use client';

import { useEffect, useRef, useState } from 'react';

import { usePlaybackPositionStore } from '../stores/playback-position-store';

export const SPEED_CYCLE = [1, 0.75, 1.25, 1.5] as const;
export type PlaybackSpeed = (typeof SPEED_CYCLE)[number];

/** Position is persisted at most this often while playing, to limit localStorage writes. */
const PERSIST_INTERVAL_MS = 2000;

export interface UseMediaPlayerOptions {
  /** Cross-visit position persistence key (e.g. the media src). Omit to disable. */
  persistKey?: string;
  onTimeUpdate?: (seconds: number) => void;
}

export interface MediaPlayerControls {
  playing: boolean;
  duration: number;
  current: number;
  speed: PlaybackSpeed;
  loading: boolean;
  error: boolean;
  togglePlay: () => void;
  seek: (deltaSeconds: number) => void;
  scrubTo: (seconds: number) => void;
  cycleSpeed: () => void;
}

/**
 * Shared playback engine for `<audio>`/`<video>` elements — play/pause, seek,
 * speed cycling, and cross-visit position persistence. `AudioPlayer` and
 * `VideoPlayer` are UI shells around this single hook (FE6.1's "one AudioBar").
 */
export function useMediaPlayer(
  mediaRef: React.RefObject<HTMLMediaElement | null>,
  hasSource: boolean,
  { persistKey, onTimeUpdate }: UseMediaPlayerOptions = {},
): MediaPlayerControls {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const restoredKeyRef = useRef<string | undefined>(undefined);
  const lastPersistAtRef = useRef(0);
  const getPosition = usePlaybackPositionStore((s) => s.getPosition);
  const setPosition = usePlaybackPositionStore((s) => s.setPosition);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const persistNow = () => {
      if (persistKey) setPosition(persistKey, el.currentTime);
    };

    const onLoading = () => setLoading(true);
    const onReady = () => {
      setLoading(false);
      setDuration(el.duration || 0);
      if (persistKey && restoredKeyRef.current !== persistKey) {
        restoredKeyRef.current = persistKey;
        const resumeAt = getPosition(persistKey);
        if (resumeAt > 0 && resumeAt < (el.duration || Infinity)) {
          el.currentTime = resumeAt;
          setCurrent(resumeAt);
        }
      }
    };
    const onTime = () => {
      setCurrent(el.currentTime);
      onTimeUpdate?.(el.currentTime);
      const now = Date.now();
      if (persistKey && now - lastPersistAtRef.current > PERSIST_INTERVAL_MS) {
        lastPersistAtRef.current = now;
        persistNow();
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      persistNow();
    };
    const onEnd = () => {
      setPlaying(false);
      persistNow();
    };
    const onError = () => {
      setLoading(false);
      setError(true);
    };

    el.addEventListener('loadstart', onLoading);
    el.addEventListener('canplaythrough', onReady);
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('loadstart', onLoading);
      el.removeEventListener('canplaythrough', onReady);
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onError);
    };
  }, [mediaRef, persistKey, onTimeUpdate, getPosition, setPosition]);

  function togglePlay() {
    const el = mediaRef.current;
    if (!el || !hasSource || error) return;
    if (playing) el.pause();
    else void el.play().catch(() => setError(true));
  }

  function seek(deltaSeconds: number) {
    const el = mediaRef.current;
    if (!el || !hasSource) return;
    el.currentTime = Math.max(0, Math.min(duration || el.duration || 0, el.currentTime + deltaSeconds));
  }

  function scrubTo(seconds: number) {
    const el = mediaRef.current;
    if (!el || !hasSource) return;
    el.currentTime = seconds;
    setCurrent(seconds);
  }

  function cycleSpeed() {
    const el = mediaRef.current;
    const nextIndex = (SPEED_CYCLE.indexOf(speed) + 1) % SPEED_CYCLE.length;
    const next = SPEED_CYCLE[nextIndex] ?? 1;
    setSpeed(next);
    if (el) el.playbackRate = next;
  }

  return { playing, duration, current, speed, loading, error, togglePlay, seek, scrubTo, cycleSpeed };
}
