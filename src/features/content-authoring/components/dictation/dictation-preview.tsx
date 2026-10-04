'use client';

import { useMemo, useState } from 'react';
import { Eye, Monitor, RotateCcw, Smartphone, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import {
  DictationBody,
  DictationReaderCard,
  PRACTICE_ACCENT,
} from '@/features/student/exercises/runner';
import type { DictationSubmitDetails } from '@/features/student/exercises/types/attempts';
import {
  check,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type DictationContent,
  type SegmentState,
} from '@/lib/shared-kernel/dictation';

type Device = 'phone' | 'desktop' | 'reader';

/** The desktop body's own width in the prototype's preview. */
const DESKTOP_MIN = 620;

export interface DictationPreviewProps {
  exercise: DictationContent;
}

/**
 * The student's view of the dictation being built — the runner's own body, not a lookalike
 * (AC-X10), fed through `toStudentProjection`, which is what drops the key and the unfinished
 * sentences (plan 68 §7.7).
 *
 * **The verdict is real.** It runs the kernel's `check` — the function the engine calls — in
 * the teacher's browser, which holds the key anyway (precedent: plans 54, 66, 67). It is not
 * an attempt: nothing is recorded, and there is no pause between checks, because the pause
 * protects the server from a script and this one has no server.
 *
 * Three devices — phone, desktop and the reader's card (Q6-A) — and *Static* (everything
 * drawn, nothing accepts input) or *Live*. The player is the student's, with a silent clip
 * of the stored length standing in while no file is attached (Q7-A).
 */
export function DictationPreview({ exercise }: DictationPreviewProps) {
  const t = useTranslations('Authoring.dictation.preview');

  const [device, setDevice] = useState<Device>('phone');
  const [mode, setMode] = useState<'static' | 'live'>('live');

  const content = useMemo(() => toContent(exercise), [exercise]);
  const projection = useMemo(
    () => toStudentProjection(content, toExpectedAnswers(exercise)),
    [content, exercise],
  );
  const audio = useExerciseAudio(content, { simulate: true });

  const [states, setStates] = useState<SegmentState[]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<DictationSubmitDetails | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ pct: number; passed: boolean } | null>(null);

  /*
    When what the student would be handed changes, the attempt starts again — during render,
    not in an effect, so no frame shows a verdict over sentences that just changed. The key
    is not in the signature on purpose: rewording a reason should not wipe a check the author
    is looking at; the next check reads the new key anyway.
  */
  const signature = JSON.stringify([
    projection,
    content.audio.settings,
    exercise.settings.threshold,
    exercise.marking,
  ]);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    restart();
  }

  function restart() {
    setStates([]);
    setSegmentIndex(0);
    setText('');
    setVerdict(null);
    setAttempt(1);
    setDone(false);
    setResult(null);
  }

  const segment = projection.segments[segmentIndex];

  function send(reveal = false) {
    if (segment === undefined) return;
    const outcome = check({
      ex: exercise,
      segmentId: segment.id,
      ...(reveal ? { reveal: true } : { text }),
      segments: states,
    });
    // A refusal is the runner offering what the engine would refuse — not reachable through
    // the body, which draws its buttons from the same state.
    if (!outcome.ok) return;
    const { completedNow: _completedNow, ...details } = outcome.result;
    setVerdict(details);
    setStates(details.segments);
    setAttempt(details.attempt);
    setResult({ pct: details.attemptPct, passed: details.attemptPassed });
  }

  function next() {
    const ahead = projection.segments.findIndex(
      (s, i) => i > segmentIndex && states.find((st) => st.segmentId === s.id)?.closed !== true,
    );
    if (ahead === -1) {
      setDone(true);
      return;
    }
    const here = states.find((st) => st.segmentId === projection.segments[ahead]?.id);
    setSegmentIndex(ahead);
    setText(here?.lastText ?? '');
    setVerdict(null);
    setAttempt((here?.checks ?? 0) + 1);
  }

  const interactive = mode === 'live';

  const body =
    projection.segments.length === 0 ? (
      <p className="m-0 text-sm text-(--ssz-text-muted)">{t('empty')}</p>
    ) : device === 'reader' ? (
      <DictationReaderCard
        title={exercise.title}
        sentences={projection.segments.length}
        duration={exercise.audio.duration}
        plays={exercise.audio.settings.plays}
        instruction={projection.instruction}
        interactive={interactive}
        onStart={() => setDevice('phone')}
        accent={PRACTICE_ACCENT}
      />
    ) : (
      <DictationBody
        projection={projection}
        title={exercise.title}
        segmentIndex={segmentIndex}
        states={states}
        text={text}
        onText={setText}
        verdict={verdict}
        attempt={attempt}
        done={done}
        result={result}
        interactive={interactive}
        layout={device}
        onCheck={() => send()}
        onRetry={() => {
          if (verdict === null) return;
          setAttempt(verdict.attempt + 1);
          setVerdict(null);
        }}
        onReveal={() => send(true)}
        onNext={next}
        onFinish={() => setDone(true)}
        accent={PRACTICE_ACCENT}
        audio={audio}
      />
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--ssz-border-default) px-3 py-2">
        <Eye size={15} aria-hidden="true" className="text-(--ssz-text-muted)" />
        <strong className="text-xs font-bold tracking-wide text-(--ssz-text-muted) uppercase">
          {device === 'phone' ? t('phone') : device === 'desktop' ? t('desktop') : t('reader')}
        </strong>
        <span className="flex-1" />
        <Segmented<Device>
          aria-label={t('deviceLabel')}
          size="sm"
          iconOnly
          value={device}
          onValueChange={setDevice}
          options={[
            { value: 'phone', label: t('phone'), icon: Smartphone },
            { value: 'desktop', label: t('desktop'), icon: Monitor },
            { value: 'reader', label: t('reader'), icon: Type },
          ]}
        />
        <Segmented<'static' | 'live'>
          aria-label={t('modeLabel')}
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'static', label: t('static') },
            { value: 'live', label: t('live') },
          ]}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('restart')}
          title={t('restart')}
          onClick={restart}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      {/* No vertical padding on the scroller: the phone body pins its action bar with
          `sticky bottom-0`, which stops at the scroller's content edge. */}
      <div className="flex-1 overflow-auto px-4">
        <div className="py-4">
          {device === 'desktop' ? (
            <div style={{ minWidth: DESKTOP_MIN }}>{body}</div>
          ) : (
            <div className="mx-auto max-w-[390px]">{body}</div>
          )}
        </div>
      </div>
      <p className="m-0 px-4 pb-3 text-[11px] text-(--ssz-text-muted)">{t('note')}</p>
    </div>
  );
}
