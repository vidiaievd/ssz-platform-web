'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useExerciseForRunner } from '@/features/content/api/use-exercise';
import { uploadRecording, type AssetResponse } from '@/features/media';
import {
  AttemptRequestError,
  fetchDraft,
  fetchLastAttempt,
  resolveSubmitFailure,
  useSaveDraft,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import {
  createBrowserRecorder,
  useRecorder,
  type CapturedTake,
  type RecorderPort,
} from '@/features/student/exercises/recorder';
import {
  GRADED_ACCENT,
  ReadAloudBody,
  ReadAloudGraded,
  ReadAloudReaderCard,
  readReadAloudProjection,
  type ReadAloudStage,
  type TakeSource,
} from '@/features/student/exercises/runner';
import type { AttemptRecord } from '@/features/student/exercises/types/attempts';
import {
  readDraft,
  readSubmission,
  TEMPLATE_CODE,
  toDraft,
  toSubmission,
  unsentAssets,
  type Draft,
  type RecorderConfig,
  type StudentProjection,
  type SubmittedRecording,
} from '@/lib/shared-kernel/read-aloud';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface ReadAloudSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** The exercise's title, from the lesson item — the card's and the header's name. */
  title?: string;
  /** Fired once, on hand-in. Always `null` — nothing here is judged by the machine. */
  onChecked?: (ok: boolean | null) => void;
  /** On the shared solver signature, unread. */
  stacked?: boolean;
  /** The microphone. Tests pass a mock; the product uses the browser's. */
  createPort?: () => RecorderPort;
}

const FINISHED = new Set(['ROUTED_FOR_REVIEW', 'SCORED', 'RETURNED']);

/** Refusals that mean the take itself is unusable — it goes back to the budget. */
const RETAKE_CODES = new Set([
  'RA_RECORDING_NOT_FOUND',
  'RA_RECORDING_FAILED',
  'RA_RECORDING_LENGTH',
]);

/** Media keys of a recording read by its owner — url, length, peaks and whose attempt it is. */
const recordingKey = (assetId: string) => ['media', 'recording', assetId] as const;

async function fetchRecording(assetId: string): Promise<AssetResponse | null> {
  try {
    const res = await fetch(`/api/media/assets/${assetId}`);
    if (!res.ok) return null;
    return (await res.json()) as AssetResponse;
  } catch {
    return null;
  }
}

/**
 * `read_aloud` in the reader: a card, then the recorder against the server (plan 70, phase 6).
 *
 * **The card first** — unless there is already handed-in work to come back to, which opens
 * straight on «hos læreren» or the verdict. The card is drawn from the display projection the
 * page has already loaded, so it costs no attempt and asks for no microphone.
 */
export function ReadAloudSolver({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
  createPort = createBrowserRecorder,
}: ReadAloudSolverProps) {
  const display = useExerciseForRunner(exerciseId);
  const [stage, setStage] = useState<'deciding' | 'card' | 'run'>('deciding');

  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void fetchLastAttempt(exerciseId).then((last) =>
      setStage(
        last !== null && last.templateCode === TEMPLATE_CODE && FINISHED.has(last.status)
          ? 'run'
          : 'card',
      ),
    );
  }, [exerciseId]);

  if (stage === 'run') {
    return (
      <ReadAloudRun
        exerciseId={exerciseId}
        language={language}
        createPort={createPort}
        {...(title === undefined ? {} : { title })}
        {...(instruction === undefined ? {} : { instruction })}
        {...(onChecked === undefined ? {} : { onChecked })}
      />
    );
  }

  if (stage === 'deciding' || display.isLoading) {
    return <LearningSkeleton variant="list" rows={2} />;
  }

  const projection = readReadAloudProjection(display.data?.content);
  if (display.isError || projection === null) {
    return <ErrorState onRetry={() => display.refetch()} />;
  }

  return (
    <ReadAloudReaderCard
      projection={projection}
      {...(title === undefined ? {} : { title })}
      {...(instruction === undefined ? {} : { instruction })}
      onStart={() => setStage('run')}
      accent={GRADED_ACCENT}
    />
  );
}

/** Where a session opens: recording, waiting for the teacher, or reading the verdict. */
type Opening =
  | { stage: 'draft'; draft: Draft | null }
  | { stage: 'sent'; recordings: SubmittedRecording[] }
  | { stage: 'graded'; recordings: SubmittedRecording[]; verdict: AttemptRecord };

interface RunProps {
  exerciseId: string;
  language: string;
  instruction?: string;
  title?: string;
  onChecked?: (ok: boolean | null) => void;
  createPort: () => RecorderPort;
}

/**
 * The attempt, and what this learner already has on it.
 *
 * Three pasts, in this order: work handed in and waiting (`ROUTED_FOR_REVIEW`) — nothing to
 * record until the teacher answers; takes uploaded onto the open attempt's draft — the
 * learner was mid-way (RA-R10); a verdict — the last thing that happened. Takes on the draft
 * outrank a verdict: after «Ta opp på nytt og lever» the new attempt's takes are the work.
 *
 * Each draft take is asked about before it is offered: a recording belongs to the attempt it
 * was made for (Q2-A), and an attempt restarted under the learner (the start route abandons a
 * stale one and carries its draft across) holds takes the engine will refuse. Those are dropped
 * here rather than at hand-in.
 */
function ReadAloudRun({
  exerciseId,
  language,
  instruction,
  title,
  onChecked,
  createPort,
}: RunProps) {
  const queryClient = useQueryClient();
  const start = useStartAttempt(exerciseId);
  const [session, setSession] = useState<{
    attemptId: string;
    projection: StudentProjection;
    document: unknown;
    opening: Opening;
  } | null>(null);
  const [unusable, setUnusable] = useState(false);
  /** The past is looked at once — a redo opens a clean attempt, not the verdict again. */
  const considered = useRef(false);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: async (data) => {
          const projection = readReadAloudProjection(data.exerciseContent);
          if (projection === null) {
            setUnusable(true);
            return;
          }

          let opening: Opening = { stage: 'draft', draft: null };
          if (!considered.current) {
            considered.current = true;
            const [saved, last] = await Promise.all([
              fetchDraft(exerciseId, data.attemptId),
              fetchLastAttempt(exerciseId),
            ]);
            const mine = last !== null && last.templateCode === TEMPLATE_CODE ? last : null;
            const handedIn = readSubmission(mine?.submittedAnswer)?.recordings ?? [];
            const draft = await verifiedDraft(
              readDraft(saved?.draftAnswer),
              data.attemptId,
              (asset) => queryClient.setQueryData(recordingKey(asset.id), asset),
            );

            if (mine !== null && mine.status === 'ROUTED_FOR_REVIEW') {
              opening = { stage: 'sent', recordings: handedIn };
            } else if (Object.keys(draft.takes).length > 0) {
              opening = { stage: 'draft', draft };
            } else if (mine !== null && FINISHED.has(mine.status)) {
              opening = { stage: 'graded', recordings: handedIn, verdict: mine };
            }
          }

          setSession({
            attemptId: data.attemptId,
            projection,
            document: data.exerciseContent,
            opening,
          });
        },
      },
    );
  }, [startMutate, language, exerciseId, queryClient]);

  useEffect(() => {
    begin();
  }, [begin]);

  if (!unusable && (start.isPending || (start.isSuccess && session === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || session === null) {
    return (
      <ErrorState
        onRetry={() => {
          setUnusable(false);
          begin();
        }}
      />
    );
  }

  return (
    <ReadAloudSession
      // A redo is a new attempt and a new recorder — nothing of the old one carries over.
      key={session.attemptId}
      exerciseId={exerciseId}
      attemptId={session.attemptId}
      projection={session.projection}
      document={session.document}
      opening={session.opening}
      createPort={createPort}
      onRedo={() => {
        setSession(null);
        begin();
      }}
      {...(title === undefined ? {} : { title })}
      {...(instruction === undefined ? {} : { instruction })}
      {...(onChecked === undefined ? {} : { onChecked })}
    />
  );
}

/** The draft's takes that are this attempt's and still in storage. */
async function verifiedDraft(
  draft: Draft,
  attemptId: string,
  remember: (asset: AssetResponse) => void,
): Promise<Draft> {
  const takes: Draft['takes'] = {};
  const chosen: Draft['chosen'] = {};
  for (const [itemId, own] of Object.entries(draft.takes)) {
    const assets = await Promise.all(own.map((take) => fetchRecording(take.assetId)));
    const kept = own.filter((_, i) => {
      const asset = assets[i];
      if (asset == null || asset.entityId !== attemptId) return false;
      if (asset.status === 'FAILED' || asset.status === 'DELETED') return false;
      remember(asset);
      return true;
    });
    if (kept.length === 0) continue;
    // Renumbered: the kernel numbers takes by their place.
    takes[itemId] = kept.map((take, i) => ({ ...take, n: i + 1 }));
    const picked = own[draft.chosen[itemId] ?? -1];
    const at = picked === undefined ? -1 : kept.indexOf(picked);
    if (at >= 0) chosen[itemId] = at;
  }
  return { takes, chosen };
}

interface SessionProps {
  exerciseId: string;
  attemptId: string;
  projection: StudentProjection;
  document: unknown;
  opening: Opening;
  instruction?: string;
  title?: string;
  onChecked?: (ok: boolean | null) => void;
  onRedo: () => void;
  createPort: () => RecorderPort;
}

/**
 * One attempt at the microphone.
 *
 * A take goes up as soon as it is made, in the background (plan 70 §3.4): the student listens
 * to the local copy meanwhile, and the hand-in waits only for the last one. Every uploaded take
 * and the choice between them are saved on the attempt's draft, so a reload loses nothing that
 * reached the server.
 */
function ReadAloudSession({
  exerciseId,
  attemptId,
  projection,
  document,
  opening,
  instruction,
  title,
  onChecked,
  onRedo,
  createPort,
}: SessionProps) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const [port] = useState(createPort);
  const config = useMemo<RecorderConfig>(
    () => ({ prompts: projection.prompts, recording: projection.recording }),
    [projection],
  );

  const [stage, setStage] = useState<ReadAloudStage>(opening.stage);
  const [submitted, setSubmitted] = useState<SubmittedRecording[]>(
    opening.stage === 'draft' ? [] : opening.recordings,
  );
  const verdict = opening.stage === 'graded' ? opening.verdict : null;
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  /** The envelope of each take recorded here, by its `blob:` URL — its waveform until upload. */
  const [envelopes, setEnvelopes] = useState<Record<string, number[]>>({});
  /** The bytes of each take recorded here, kept for a retried upload. */
  const captures = useRef(new Map<string, CapturedTake>());
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const audio = useExerciseAudio(document);
  const submit = useSubmitAnswer(exerciseId, attemptId);
  const saveDraft = useSaveDraft(exerciseId, attemptId);

  const labelOf = (itemId: string) => {
    const i = projection.prompts.findIndex((p) => p.id === itemId);
    return projection.prompts[i]?.label.trim() || t('promptN', { n: i + 1 });
  };

  function upload(take: CapturedTake) {
    const ext = take.mimeType.includes('mp4')
      ? 'm4a'
      : take.mimeType.includes('ogg')
        ? 'ogg'
        : 'webm';
    uploadRecording({
      blob: take.blob,
      mimeType: take.mimeType,
      attemptId,
      filename: `${take.itemId}-take-${take.n}.${ext}`,
    }).then(
      ({ assetId }) => recorder.uploaded(take.itemId, take.n, assetId),
      () => recorder.uploadFailed(take.itemId, take.n),
    );
  }

  const recorder = useRecorder({
    config,
    port: stage === 'draft' ? port : null,
    initialDraft: opening.stage === 'draft' ? opening.draft : null,
    onCaptured: (take) => {
      captures.current.set(`${take.itemId}:${take.n}`, take);
      setEnvelopes((all) => ({ ...all, [take.url]: take.envelope }));
      upload(take);
    },
  });

  // Every uploaded take and the choice between them, onto the attempt (RA-R10). Keyed by the
  // draft's own content, so a level or a tick does not send it again.
  const draft = toDraft(recorder.state);
  const draftKey = JSON.stringify(draft);
  const hasTakes = Object.keys(draft.takes).length > 0;
  const saveDraftMutate = saveDraft.mutate;
  /** What the server holds already; '' — nothing yet, and an empty draft is not worth a save. */
  const lastSaved = useRef(
    opening.stage === 'draft' && opening.draft !== null ? JSON.stringify(opening.draft) : '',
  );
  useEffect(() => {
    if (stage !== 'draft' || draftKey === lastSaved.current) return;
    if (!hasTakes && lastSaved.current === '') return;
    lastSaved.current = draftKey;
    saveDraftMutate({ draftAnswer: JSON.parse(draftKey) as Draft });
  }, [draftKey, hasTakes, stage, saveDraftMutate]);

  // Assets read back from the server: restored takes and everything handed in.
  const remoteIds = [
    ...Object.values(recorder.state.takes)
      .flat()
      .flatMap((take) => (take.ref === null && take.assetId !== null ? [take.assetId] : [])),
    ...submitted.map((r) => r.assetId),
  ];
  const remote = useQueries({
    queries: [...new Set(remoteIds)].map((id) => ({
      queryKey: recordingKey(id),
      queryFn: () => fetchRecording(id),
      staleTime: 5 * 60_000,
    })),
  });
  const assets = new Map<string, AssetResponse>();
  for (const q of remote) if (q.data != null) assets.set(q.data.id, q.data);

  // Whose take a local URL is, so a handed-in take keeps playing from the browser's copy.
  const refByAsset = new Map<string, string>();
  for (const take of Object.values(recorder.state.takes).flat()) {
    if (take.ref !== null && take.assetId !== null) refByAsset.set(take.assetId, take.ref);
  }

  function sourceOf(ref: string | null, assetId: string | null): TakeSource {
    const local = ref ?? (assetId === null ? undefined : refByAsset.get(assetId));
    if (local !== undefined) return { src: local, peaks: envelopes[local] ?? null };
    const asset = assetId === null ? undefined : assets.get(assetId);
    if (asset !== undefined) return { src: asset.url || null, peaks: asset.peaks ?? null };
    return { src: null, peaks: null };
  }

  function retryUpload(itemId: string, n: number) {
    const take = captures.current.get(`${itemId}:${n}`);
    if (take === undefined) return;
    recorder.uploadRetry(itemId, n);
    upload(take);
  }

  /**
   * A take the server cannot use goes, and gives its slot back (decided 06.10): the file is gone
   * or broken, or the server measured it outside the prompt's range. Recording again is the only
   * fix, and a spent budget must not stand in its way. «Still uploading» is not a refusal — the
   * take is fine and only late.
   */
  function takeBack(e: AttemptRequestError, sent: SubmittedRecording[]) {
    if (!RETAKE_CODES.has(e.code ?? '')) return;
    for (const itemId of e.itemIds) {
      const assetId = sent.find((r) => r.itemId === itemId)?.assetId;
      const take = recorder.state.takes[itemId]?.find((x) => x.assetId === assetId);
      if (assetId === undefined || take === undefined) continue;
      recorder.refused(itemId, take.n);
      void fetch(`/api/media/assets/${assetId}`, { method: 'DELETE' }).catch(() => undefined);
    }
  }

  function refusal(e: AttemptRequestError): string {
    const labels = e.itemIds.map(labelOf).join(', ') || labelOf(projection.prompts[0]?.id ?? '');
    if (e.code === 'RA_RECORDING_NOT_READY') return t('refused.notReady', { labels });
    if (e.code === 'RA_RECORDING_LENGTH') return t('refused.length', { labels });
    return t('refused.retake', { labels });
  }

  function send() {
    const submission = toSubmission(recorder.state, config);
    if (submission === null) return;
    setError(null);

    const delivered = () => {
      setSubmitted(submission.recordings);
      setStage('sent');
      // The takes the teacher will not hear go (DECISIONS §1); a failed delete costs nothing
      // but storage (§8 item 5).
      for (const id of unsentAssets(recorder.state, submission)) {
        void fetch(`/api/media/assets/${id}`, { method: 'DELETE' }).catch(() => undefined);
      }
      onChecked?.(null);
    };

    submit.mutate(
      {
        submittedAnswer: submission,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: delivered,
        onError: async (e) => {
          if (
            e instanceof AttemptRequestError &&
            e.status === 422 &&
            e.code?.startsWith('RA_RECORDING_')
          ) {
            setError(refusal(e));
            takeBack(e, submission.recordings);
            return;
          }
          if (e instanceof AttemptRequestError && e.status === 503) {
            setError(t('mediaUnavailable'));
            return;
          }
          setConfirming(true);
          const resolution = await resolveSubmitFailure(exerciseId, attemptId);
          setConfirming(false);
          if (resolution === 'delivered') delivered();
          else setError(resolution === 'unconfirmed' ? t('sendUnconfirmed') : t('sendFailed'));
        },
      },
    );
  }

  const graded =
    verdict === null ? null : (
      <ReadAloudGraded
        passed={verdict.passed}
        revision={projection.settings.revision}
        showRubric={projection.settings.showRubric}
        showModel={projection.settings.showModel}
        snapshot={verdict.rubricSnapshot ?? null}
        marks={verdict.rubricMarks ?? null}
        decisions={verdict.reviewDecisions}
        comment={verdict.reviewComment}
        recordings={submitted}
        labelOf={labelOf}
        sourceOf={sourceOf}
        onRedo={onRedo}
        {...(audio.audio.enabled ? { onPlayModel: audio.toggle } : {})}
      />
    );

  return (
    <ReadAloudBody
      projection={projection}
      recorder={recorder}
      config={config}
      {...(title === undefined ? {} : { title })}
      {...(instruction === undefined ? {} : { instruction })}
      stage={stage}
      sourceOf={sourceOf}
      submitted={submitted}
      graded={graded}
      onSubmit={send}
      onRetryUpload={retryUpload}
      submitting={submit.isPending || confirming}
      error={error}
      accent={GRADED_ACCENT}
      audio={audio}
    />
  );
}
