'use client';

import { Mic, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import type { RecorderPort } from '@/features/student/exercises/recorder';
import { PrecheckPanel } from '@/features/student/precheck';

import type { SentenceAnswer, SentenceLine, SentenceRecording } from './sentence-recording';

type Phase =
  | { name: 'idle' }
  | { name: 'recording' }
  | { name: 'sending' }
  | { name: 'mic'; why: 'denied' | 'noDevice' };

export interface SentenceTakeProps {
  itemId: string;
  sentence: string;
  recording: SentenceRecording;
}

/**
 * Say the sentence in front of you and hear what a model made of it (plan 86, step 6g). One take
 * at a time, nothing kept: the answer replaces the last one. A final refusal («closed») takes the
 * button away; every other trouble leaves it, with a line.
 */
export function SentenceTake({ itemId, sentence, recording }: SentenceTakeProps) {
  const t = useTranslations('ExerciseRunner.prosody.take');
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [answer, setAnswer] = useState<SentenceAnswer | null>(null);
  const port = useRef<RecorderPort | null>(null);
  const busy = useRef(false);

  // The microphone is the drill's for one take: let go of it when the sentence changes or the card goes.
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
    setAnswer(null);
    port.current ??= recording.createPort();
    const opened = await port.current.open();
    if (opened !== 'ok') {
      busy.current = false;
      setPhase({ name: 'mic', why: opened });
      return;
    }
    port.current.start();
    setPhase({ name: 'recording' });
  }

  async function end() {
    const current = port.current;
    if (current === null) return;
    setPhase({ name: 'sending' });
    const capture = await current.stop();
    current.close();
    port.current = null;
    if (capture === null) {
      busy.current = false;
      setPhase({ name: 'idle' });
      return;
    }
    const heard = await recording.check({ itemId, sentence, capture });
    busy.current = false;
    setAnswer(heard);
    setPhase({ name: 'idle' });
  }

  const closed = answer?.kind === 'line' && answer.line === 'closed';
  const recordingNow = phase.name === 'recording';

  return (
    <div className="flex flex-col gap-2">
      {!closed && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={phase.name === 'sending'}
            onClick={recordingNow ? () => void end() : () => void begin()}
            aria-pressed={recordingNow}
            className="inline-flex items-center gap-1.5 rounded-full border border-(--ssz-border-strong) px-3 py-1 text-sm font-medium text-(--ssz-text-primary) hover:bg-(--ssz-bg-hover) disabled:opacity-50"
          >
            {recordingNow ? (
              <Square aria-hidden className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Mic aria-hidden className="h-3.5 w-3.5" />
            )}
            {recordingNow ? t('stop') : answer === null ? t('record') : t('again')}
          </button>
          <span role="status" className="text-xs text-(--ssz-text-muted)">
            {recordingNow ? t('recording') : phase.name === 'sending' ? t('hearing') : ''}
          </span>
        </div>
      )}

      {phase.name === 'mic' && (
        <p role="alert" className="text-sm text-(--ssz-text-secondary)">
          {t(`mic.${phase.why}`)}
        </p>
      )}
      {answer?.kind === 'line' && (
        <p role="alert" className="text-sm text-(--ssz-text-secondary)">
          {t(`line.${answer.line satisfies SentenceLine}`)}
        </p>
      )}
      {answer?.kind === 'heard' && <PrecheckPanel result={answer.result} />}
    </div>
  );
}
