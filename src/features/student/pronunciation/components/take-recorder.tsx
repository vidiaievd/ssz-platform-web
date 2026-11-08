'use client';

import { Mic, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import {
  createBrowserRecorder,
  type Capture,
  type RecorderPort,
} from '@/features/student/exercises/recorder';

export interface TakeRecorderProps {
  /** A take is being heard; the button waits. */
  sending: boolean;
  onCapture: (capture: Capture) => void;
  /** For tests: a microphone that is not the browser's. */
  createPort?: () => RecorderPort;
}

/**
 * One button that records a take and hands it over (plan 86, step 16.3). The microphone is the
 * button's for one take: opened on press, released after the take, and on leaving the card.
 */
export function TakeRecorder({ sending, onCapture, createPort = createBrowserRecorder }: TakeRecorderProps) {
  const t = useTranslations('Pronunciation.record');
  const [recording, setRecording] = useState(false);
  const [mic, setMic] = useState<'denied' | 'noDevice' | null>(null);
  const port = useRef<RecorderPort | null>(null);
  const busy = useRef(false);

  useEffect(
    () => () => {
      port.current?.cancel();
      port.current?.close();
      port.current = null;
    },
    [],
  );

  async function begin() {
    if (busy.current) return;
    busy.current = true;
    setMic(null);
    port.current ??= createPort();
    const opened = await port.current.open();
    if (opened !== 'ok') {
      busy.current = false;
      setMic(opened);
      return;
    }
    port.current.start();
    setRecording(true);
  }

  async function end() {
    const current = port.current;
    if (current === null) return;
    setRecording(false);
    const capture = await current.stop();
    current.close();
    port.current = null;
    busy.current = false;
    if (capture !== null) onCapture(capture);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={sending}
          onClick={recording ? () => void end() : () => void begin()}
          aria-pressed={recording}
          className="inline-flex items-center gap-2 rounded-full bg-(--ssz-color-primary-600) px-5 py-2.5 text-sm font-semibold text-white hover:bg-(--ssz-color-primary-700) disabled:opacity-50"
        >
          {recording ? (
            <Square aria-hidden className="h-4 w-4 fill-current" />
          ) : (
            <Mic aria-hidden className="h-4 w-4" />
          )}
          {recording ? t('stop') : t('record')}
        </button>
        <span role="status" className="text-sm text-(--ssz-text-muted)">
          {recording ? t('recording') : sending ? t('hearing') : ''}
        </span>
      </div>
      {mic !== null && (
        <p role="alert" className="text-sm text-(--ssz-text-secondary)">
          {t(`mic.${mic}`)}
        </p>
      )}
    </div>
  );
}
