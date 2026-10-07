'use client';

import { useMemo, useRef, useState } from 'react';
import { Eye, Monitor, RotateCcw, Smartphone, Type, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import {
  createBrowserRecorder,
  useRecorder,
  type RecorderPort,
} from '@/features/student/exercises/recorder';
import {
  GRADED_ACCENT,
  ReadAloudBody,
  ReadAloudGraded,
  ReadAloudReaderCard,
  type ReadAloudStage,
  type TakeSource,
} from '@/features/student/exercises/runner';
import { applyAudioDraft } from '@/lib/shared-kernel/audio';
import {
  scorePrompts,
  simulatedMarks,
  snapshotOf,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  toSubmission,
  type RecorderConfig,
  type StudentProjection,
  type SubmittedRecording,
} from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';

type Device = 'phone' | 'desktop' | 'reader';

export interface ReadAloudPreviewProps {
  exercise: ReadAloudDocument;
  /** The microphone. Tests pass a mock; the builder uses the browser's. */
  createPort?: () => RecorderPort;
}

/**
 * The student's view of the exercise being built — the runner's own body, not a lookalike
 * (RA-B17), fed through `toStudentProjection`, which is what drops the listening notes, the focus
 * words and the pass mark (plan 70 §7.8).
 *
 * Three devices — phone, desktop (one column, centred, as in the spec) and the reader's card — and
 * *Static* (everything drawn, nothing accepts input, no microphone) or *Live*. Live records with
 * the real microphone, through the same adapter the student has, and **nothing leaves the
 * browser**: a take is played from its `blob:` URL, and «send» only moves the preview to «hos
 * læreren». Nothing is an attempt, so nothing is recorded anywhere.
 *
 * What a teacher would say cannot be known and is not computed by a machine; the one button that
 * shows the graded card marks every criterion of every prompt «2» (Q8-A), so an author sees what
 * the verdict card looks like with their own rubric in it.
 */
export function ReadAloudPreview({
  exercise,
  createPort = createBrowserRecorder,
}: ReadAloudPreviewProps) {
  const t = useTranslations('Authoring.readAloud.preview');

  const [device, setDevice] = useState<Device>('phone');
  const [mode, setMode] = useState<'static' | 'live'>('static');
  /** Bumped by «restart» and by a change of what the student would be handed. */
  const [epoch, setEpoch] = useState(0);

  const content = useMemo(() => toContent(exercise), [exercise]);
  const projection = useMemo(
    () => toStudentProjection(content, toExpectedAnswers(exercise)),
    [content, exercise],
  );
  const withAudio = useMemo(
    () =>
      applyAudioDraft(content as unknown as Record<string, unknown>, exercise.audio, TEMPLATE_CODE),
    [content, exercise.audio],
  );

  /*
    When what the student would be handed changes, the run starts again — during render, not in an
    effect, so no frame shows a recorder over a prompt that just changed. The key and the rubric
    are not in the signature on purpose: rewording a listening note must not wipe a take the
    author is looking at.
  */
  const signature = JSON.stringify(projection);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setEpoch((n) => n + 1);
  }

  const restart = () => setEpoch((n) => n + 1);

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

      <div className="flex-1 overflow-auto px-4">
        <div className="py-4">
          {device === 'reader' ? (
            <div className="mx-auto max-w-[390px]">
              <ReadAloudReaderCard
                projection={projection}
                title={exercise.title}
                interactive={mode === 'live'}
                onStart={() => setDevice('phone')}
                accent={GRADED_ACCENT}
              />
            </div>
          ) : (
            <div className={device === 'desktop' ? undefined : 'mx-auto max-w-[390px]'}>
              {projection.prompts.length === 0 ? (
                <p className="m-0 text-sm text-(--ssz-text-muted)">{t('empty')}</p>
              ) : (
                <PreviewRun
                  // A new recorder for every restart, device-independent: the layout is only a
                  // prop, and a take made on the phone view is still there on the desktop one.
                  key={`${epoch}:${mode}`}
                  exercise={exercise}
                  projection={projection}
                  document={withAudio}
                  layout={device}
                  live={mode === 'live'}
                  createPort={createPort}
                  onRestart={restart}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <p className="m-0 px-4 pb-3 text-[11px] text-(--ssz-text-muted)">
        {mode === 'live' ? t('noteLive') : t('noteStatic')}
      </p>
    </div>
  );
}

interface RunProps {
  exercise: ReadAloudDocument;
  projection: StudentProjection;
  document: unknown;
  layout: 'phone' | 'desktop';
  live: boolean;
  createPort: () => RecorderPort;
  onRestart: () => void;
}

/** One run of the exercise at the microphone — and the recorder it owns. */
function PreviewRun({
  exercise,
  projection,
  document,
  layout,
  live,
  createPort,
  onRestart,
}: RunProps) {
  const t = useTranslations('Authoring.readAloud.preview');
  const tRunner = useTranslations('ExerciseRunner.readAloud');

  const [port] = useState(() => (live ? createPort() : null));
  const config = useMemo<RecorderConfig>(
    () => ({ prompts: projection.prompts, recording: projection.recording }),
    [projection],
  );

  const [stage, setStage] = useState<ReadAloudStage>('draft');
  const [submitted, setSubmitted] = useState<SubmittedRecording[]>([]);
  /** The envelope of each take recorded here, by its `blob:` URL — its waveform. */
  const envelopes = useRef<Record<string, number[]>>({});
  const [, redraw] = useState(0);

  const audio = useExerciseAudio(document, { simulate: true });

  const recorder = useRecorder({
    config,
    port: stage === 'draft' ? port : null,
    onCaptured: (take) => {
      envelopes.current[take.url] = take.envelope;
      // Nothing is uploaded: the take is «on the server» the moment it exists, so the hand-in
      // does not wait for a network that is not there.
      recorder.uploaded(take.itemId, take.n, `preview:${take.itemId}:${take.n}`);
      redraw((n) => n + 1);
    },
  });

  const labelOf = (itemId: string) => {
    const i = projection.prompts.findIndex((p) => p.id === itemId);
    return projection.prompts[i]?.label.trim() || tRunner('promptN', { n: i + 1 });
  };

  /** Every take is local here, so its source is its `blob:` URL. */
  const sourceOf = (ref: string | null, assetId: string | null): TakeSource => {
    const local =
      ref ??
      (assetId === null
        ? undefined
        : (Object.values(recorder.state.takes)
            .flat()
            .find((take) => take.assetId === assetId)?.ref ?? undefined));
    return local === undefined
      ? { src: null, peaks: null }
      : { src: local, peaks: envelopes.current[local] ?? null };
  };

  function send() {
    const submission = toSubmission(recorder.state, config);
    if (submission === null) return;
    setSubmitted(submission.recordings);
    setStage('sent');
  }

  const graded = useMemo(() => {
    if (stage !== 'graded') return null;
    const snapshot = snapshotOf(exercise);
    const itemIds = submitted.map((r) => r.itemId);
    const marks = simulatedMarks(snapshot, itemIds);
    const outcome = scorePrompts(snapshot, marks, itemIds);
    return { snapshot, marks, outcome };
  }, [stage, exercise, submitted]);

  return (
    <div className="flex flex-col gap-3">
      <ReadAloudBody
        projection={projection}
        recorder={recorder}
        config={config}
        title={exercise.title}
        stage={stage}
        sourceOf={sourceOf}
        submitted={submitted}
        graded={
          graded === null ? null : (
            <ReadAloudGraded
              passed={graded.outcome.passed}
              revision={projection.settings.revision}
              showRubric={projection.settings.showRubric}
              showModel={projection.settings.showModel}
              snapshot={graded.snapshot}
              marks={graded.marks}
              decisions={graded.outcome.prompts.map((p) => ({
                itemId: p.itemId,
                approved: p.outcome.passed,
                comment: t('simulatedComment'),
              }))}
              comment={t('simulatedComment')}
              recordings={submitted}
              labelOf={labelOf}
              sourceOf={sourceOf}
              onRedo={onRestart}
              interactive={live}
              {...(audio.audio.enabled ? { onPlayModel: audio.toggle } : {})}
            />
          )
        }
        onSubmit={send}
        onRetryUpload={() => undefined}
        interactive={live}
        layout={layout}
        accent={GRADED_ACCENT}
        audio={audio}
      />

      {stage === 'sent' && (
        <div className="flex flex-col items-start gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setStage('graded')}>
            <Wand2 className="size-4" aria-hidden />
            {t('simulate')}
          </Button>
          <p className="m-0 text-[11px] text-(--ssz-text-muted)">{t('simulateNote')}</p>
        </div>
      )}
    </div>
  );
}
