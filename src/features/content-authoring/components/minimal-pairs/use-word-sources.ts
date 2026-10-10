'use client';

import { useEffect, useRef, useState } from 'react';

import { flatLevels, type RecorderPort } from '@/features/student/exercises/recorder';
import { setClip as setClipOf, type Provenance } from '@/lib/shared-kernel/minimal-pairs';

import { baseMime, recordingName, type ClipSources } from './clip-sources';
import type { DocumentUpdate } from './edits';

/** How often the meter reads the microphone — the recorder's 90 ms. */
const LEVEL_MS = 90;

/** What a word's row is doing right now, besides showing its clip. */
export type WordActivity = 'opening' | 'recording' | 'uploading' | 'synthesizing';

/** Why the last thing tried on a word did not land. Shown under its row until the next try. */
export type WordFailure = 'micDenied' | 'micNoDevice' | 'uploadFailed' | 'ttsFailed';

/** The word a source writes into. `text` names the file; `dialect` is kept across a re-take. */
export interface WordRef {
  pairId: string;
  wordId: string;
  text: string;
}

export interface WordSources {
  activity: ReadonlyMap<string, WordActivity>;
  failures: ReadonlyMap<string, WordFailure>;
  /** The word being recorded, if any — every other «Record» waits for it. */
  recording: string | null;
  /** The meter of the running take, `METER_BANDS` values 0..1. */
  levels: number[];
  record: (word: WordRef) => void;
  stop: () => void;
  upload: (word: WordRef, file: File) => void;
  synthesize: (word: WordRef) => void;
}

/**
 * The three per-word sources of step 2 — Record, Upload, TTS (plan 72 §3.4, MP-B11…B13).
 *
 * Each ends in one edit: the word's clip gets a new asset id, its provenance and its voice, and a
 * zero length the asset fills in once measured (`useClipAssets`). The edit is applied to the
 * document as it is when the bytes have landed, not as it was when the button was pressed — an
 * upload takes seconds, and the author keeps typing.
 *
 * The microphone is the `read_aloud` adapter's port (plan 70), without its take machine: a word
 * is one short take, «Record» → «Stopp» → upload. It is opened on the first «Record» and closed
 * with the step.
 */
export function useWordSources({
  sources,
  exerciseId,
  language,
  teacherVoice,
  onChange,
}: {
  sources: ClipSources;
  exerciseId: string;
  language: string;
  /** The author's display name — a teacher's recordings are their voice (§3.4). */
  teacherVoice: string;
  onChange: DocumentUpdate;
}): WordSources {
  const [activity, setActivity] = useState<Map<string, WordActivity>>(new Map());
  const [failures, setFailures] = useState<Map<string, WordFailure>>(new Map());
  const [recording, setRecording] = useState<WordRef | null>(null);
  const [levels, setLevels] = useState<number[]>(flatLevels);
  const mic = useRef<RecorderPort | null>(null);

  const mark = (wordId: string, next: WordActivity | null) =>
    setActivity((current) => {
      const copy = new Map(current);
      if (next === null) copy.delete(wordId);
      else copy.set(wordId, next);
      return copy;
    });
  const fail = (wordId: string, next: WordFailure | null) =>
    setFailures((current) => {
      const copy = new Map(current);
      if (next === null) copy.delete(wordId);
      else copy.set(wordId, next);
      return copy;
    });

  const attach = (
    word: WordRef,
    assetId: string,
    fileName: string,
    provenance: Provenance,
    voice: string,
  ) =>
    onChange((current) => ({
      ...current,
      ...setClipOf(current, word.pairId, word.wordId, {
        assetId,
        fileName,
        durationMs: 0,
        provenance,
        voice,
      }),
    }));

  const send = async (word: WordRef, file: File, provenance: Provenance, voice: string) => {
    mark(word.wordId, 'uploading');
    try {
      const assetId = await sources.upload(file, exerciseId);
      attach(word, assetId, file.name, provenance, voice);
    } catch {
      fail(word.wordId, 'uploadFailed');
    } finally {
      mark(word.wordId, null);
    }
  };

  // The meter, while a take runs.
  const live = recording !== null;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setLevels(mic.current?.levels() ?? flatLevels()), LEVEL_MS);
    return () => clearInterval(id);
  }, [live]);

  // A take the browser takes away — the device went, the OS took the microphone — is dropped.
  useEffect(() => {
    if (recording === null || mic.current === null) return;
    const port = mic.current;
    const wordId = recording.wordId;
    return port.onInterrupt((reason) => {
      if (reason === 'hidden') return;
      port.cancel();
      setRecording(null);
      setLevels(flatLevels());
      mark(wordId, null);
    });
  }, [recording]);

  useEffect(
    () => () => {
      mic.current?.close();
      mic.current = null;
    },
    [],
  );

  const record = (word: WordRef) => {
    if (recording !== null || activity.has(word.wordId)) return;
    fail(word.wordId, null);
    mark(word.wordId, 'opening');
    const port = (mic.current ??= sources.recorder());
    void port.open().then((result) => {
      if (result !== 'ok') {
        mark(word.wordId, null);
        fail(word.wordId, result === 'denied' ? 'micDenied' : 'micNoDevice');
        return;
      }
      port.start();
      mark(word.wordId, 'recording');
      setRecording(word);
    });
  };

  const stop = () => {
    const word = recording;
    const port = mic.current;
    if (word === null || port === null) return;
    setRecording(null);
    setLevels(flatLevels());
    void port.stop().then((capture) => {
      if (capture === null) {
        mark(word.wordId, null);
        return;
      }
      const mime = baseMime(capture.mimeType);
      const file = new File([capture.blob], recordingName(word.text, mime), { type: mime });
      return send(word, file, 'teacher', teacherVoice);
    });
  };

  const upload = (word: WordRef, file: File) => {
    if (activity.has(word.wordId)) return;
    fail(word.wordId, null);
    // An unnamed upload is «studio»; the uploads of one session then count as one voice (§3.4).
    void send(word, file, 'studio', '');
  };

  const synthesize = (word: WordRef) => {
    if (activity.has(word.wordId)) return;
    fail(word.wordId, null);
    mark(word.wordId, 'synthesizing');
    void sources
      .synthesize(word.text.trim(), language, exerciseId)
      .then(({ assetId, voice }) =>
        attach(word, assetId, recordingName(word.text, 'audio/mpeg'), 'tts', voice),
      )
      .catch(() => fail(word.wordId, 'ttsFailed'))
      .finally(() => mark(word.wordId, null));
  };

  return {
    activity,
    failures,
    recording: recording?.wordId ?? null,
    levels,
    record,
    stop,
    upload,
    synthesize,
  };
}
