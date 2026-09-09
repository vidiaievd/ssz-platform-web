'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  issues,
  stepState,
  type ErrorCorrection,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/error-correction';

import {
  withSegment,
  type AudioDraft,
  type AudioStepMap,
  type PlacedAudioIssue,
} from '@/lib/shared-kernel/audio';
import { transcriptGivesAway } from '@/lib/shared-kernel/error-correction';

import {
  AudioEnableRow,
  AudioRulesCard,
  AudioSegmentField,
  AudioSourceCard,
  AudioTranscriptCard,
  useAudioIssueCopy,
  useAudioProblems,
} from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepFormat } from './step-format';
import { StepMistakes } from './step-mistakes';
import { StepCheck } from './step-check';
import { StepFlow } from './step-flow';
import { useErrorCorrectionAutosave } from './use-error-correction-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * Where this builder keeps each part of the audio layer.
 *
 * The clip is step 1's, with the format and the instruction; the timecodes go with the
 * sentences on step 2; the rules and the transcript are step 4, which is how the exercise
 * runs. The transcript's home matters more here than anywhere else — see
 * `transcriptGivesAway`.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 2, rules: 4, transcript: 4 };

/**
 * The AI stage is stored but has no controls (plan 41, "Отложено"). Reporting a problem
 * with a switch that is nowhere on screen would leave the author with a warning they
 * cannot act on, so these are dropped here — the same treatment gap-fill gives
 * `EX_NO_TITLE`. Building the AI block means deleting this list.
 */
const UNBUILT_CODES = new Set<Issue['code']>(['AI_WITHOUT_CHECK', 'AI_UNLIMITED_BEFORE_SUBMIT']);

export interface ErrorCorrectionBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: ErrorCorrection;
  /** The listening layer, carried beside the document (plan 56 phase 6). */
  initialAudio: AudioDraft;
  /**
   * Reports every edit so the shell's preview column can render the student's view of
   * the document being written.
   */
  onDocumentChange?: (exercise: ErrorCorrection) => void;
  /**
   * Every successful save, with the token the row now carries. The shell uses it to keep
   * its cached copy of the exercise current: a cache holding a superseded token is a
   * conflict the next time this builder mounts from it.
   */
  onSavedRemote?: (updatedAt: string, saved: ErrorCorrection, audio: AudioDraft) => void;
}

/**
 * The error-correction builder: four steps over one document (BEHAVIOR §A).
 *
 * The rail is not a wizard. Every step is reachable at any time because authoring is not
 * linear — the mistakes written in step 2 are what the settings in step 3 are read
 * against, and the author will go back and forth between them. What the rail carries
 * instead of a lock is the kernel's `stepState`: which step has a blocker, which has
 * something worth a second look, and which is simply empty.
 *
 * Instructions live in the document rather than beside it, because `issues()` reads them
 * to decide whether step 1 is done.
 */
export function ErrorCorrectionBuilder({
  exerciseId,
  containerId,
  initialExercise,
  initialAudio,
  onDocumentChange,
  onSavedRemote,
}: ErrorCorrectionBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [audio, setAudio] = useState(initialAudio);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useErrorCorrectionAutosave({
    exerciseId,
    containerId,
    exercise,
    audio,
    // The token moves on with every save; the next write is compared against this one.
    onSaved: (updatedAt, saved, savedAudio) => {
      setExercise((current) => ({ ...current, updatedAt }));
      onSavedRemote?.(updatedAt, saved, savedAudio);
    },
  });

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  const problems = useMemo(
    () => issues(exercise).filter((issue) => !UNBUILT_CODES.has(issue.code)),
    [exercise],
  );
  const blockers = problems.filter((issue) => issue.level === 'blocker');

  /** The layer's findings, in the same rail and the same gate as the type's own. */
  const audioProblems = useAudioProblems(
    audio,
    exercise.items.map((item) => item.id),
    AUDIO_STEPS,
  );
  /*
    And the one audio rule this template owns (plan 56 §4). The clip is the passage read
    correctly, so a transcript on screen from the start is the answer on screen from the
    start. The rule is the kernel's — the same function the server's publish preflight
    calls — and this only places it on the step that owns the fix.
  */
  const givesAway = transcriptGivesAway({ audio: audio.audio });
  const audioBlockers = audioProblems.filter((issue) => issue.level === 'blocker').length;

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 items-stretch justify-between gap-3">
          <ErrorCorrectionSteps
            current={step}
            exercise={exercise}
            audioProblems={audioProblems}
            givesAway={givesAway}
            onSelect={setStep}
          />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <SaveHint
              status={autosave.status}
              savedAt={autosave.savedAt}
              canOverwrite={autosave.canOverwrite}
              onRetry={autosave.retry}
              onOverwrite={autosave.overwrite}
            />
            <Button type="button" onClick={() => setGateOpen(true)}>
              {t('errorCorrection.shell.done')}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <StepFormat exercise={exercise} onChange={setExercise} />

            {/* Audio adds no fifth step: it is material, and material lives on the step
                that already carries the format and the instruction (plan 56). */}
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <AudioEnableRow draft={audio} onChange={setAudio} />
            </div>
            {audio.audio.enabled && <AudioSourceCard draft={audio} onChange={setAudio} />}
          </div>
        ) : step === 2 ? (
          <div className="flex flex-col gap-5">
            <StepMistakes exercise={exercise} onChange={setExercise} />

            {/* One timecode per sentence, when the author asked for them: the clip is a
                passage and each sentence is a line of it. */}
            {audio.audio.enabled && audio.audio.useSegments && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-medium">{t('errorCorrection.audioSegments')}</p>
                {exercise.items.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t('errorCorrection.audioSegmentFor', { index: index + 1 })}
                    </span>
                    <AudioSegmentField
                      segment={audio.segments[item.id] ?? null}
                      onChange={(segment) => setAudio(withSegment(audio, item.id, segment))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : step === 3 ? (
          <StepCheck exercise={exercise} onChange={setExercise} />
        ) : (
          <div className="flex flex-col gap-5">
            <StepFlow exercise={exercise} onChange={setExercise} />

            {audio.audio.enabled && (
              <>
                <AudioRulesCard
                  draft={audio}
                  onChange={setAudio}
                  itemNoun={t('errorCorrection.audioItemNoun')}
                />
                <AudioTranscriptCard draft={audio} onChange={setAudio} />
                {givesAway && (
                  <p className="text-xs text-error" role="alert">
                    {t('errorCorrection.audioGivesAway')}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <StepNav current={step} onSelect={setStep} onDone={() => setGateOpen(true)} />
      </div>

      <GateDialog
        open={gateOpen}
        problems={problems}
        audioProblems={audioProblems}
        givesAway={givesAway}
        blockerCount={blockers.length + audioBlockers + (givesAway ? 1 : 0)}
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target);
          setGateOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Where the problems are, per step, in the rail every builder shares. The state comes
 * from the kernel's `stepState`, so the rail, the gate and the server cannot disagree
 * about what is wrong — and `info` issues deliberately leave it green, because a dot
 * that turns amber for a remark teaches the author to stop reading it.
 */
function ErrorCorrectionSteps({
  current,
  exercise,
  audioProblems,
  givesAway,
  onSelect,
}: {
  current: IssueStep;
  exercise: ErrorCorrection;
  audioProblems: PlacedAudioIssue[];
  givesAway: boolean;
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    const own = stepState(exercise, step);
    // Both lists at once, plus this template's own audio rule, which lives on the step
    // that carries the transcript. A rail counting only one of them would show green over
    // an exercise the server's preflight refuses.
    const here = audioProblems.filter((issue) => issue.step === step && issue.level !== 'info');
    const mine =
      here.filter((issue) => issue.level === 'blocker').length +
      (givesAway && step === AUDIO_STEPS.transcript ? 1 : 0);
    const state = mine > 0 ? 'err' : here.length > 0 && own.state !== 'err' ? 'warn' : own.state;
    const blockers = (own.state === 'err' ? own.blockers : 0) + mine;

    return {
      n: step,
      label: t(`errorCorrection.shell.step${step}` as 'errorCorrection.shell.step1'),
      sub: t(`errorCorrection.shell.stepSub${step}` as 'errorCorrection.shell.stepSub1'),
      ...(state === 'err'
        ? {
            status: 'blockers' as const,
            blockers,
            statusLabel: t('errorCorrection.shell.blockerCount', { count: blockers }),
          }
        : state === 'warn'
          ? { status: 'warn' as const, statusLabel: t('errorCorrection.shell.stepCheck') }
          : state === 'empty'
            ? { status: 'empty' as const, statusLabel: t('errorCorrection.shell.stepEmpty') }
            : { status: 'ok' as const, statusLabel: t('errorCorrection.shell.stepOk') }),
    };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={t('errorCorrection.shell.stepsLabel')}
    />
  );
}

interface StepNavProps {
  current: IssueStep;
  onSelect: (step: IssueStep) => void;
  onDone: () => void;
}

/**
 * The way forward at the bottom of a step, so an author who has just finished the last
 * sentence does not travel back up to the rail to carry on. Nothing here validates:
 * steps are reachable in any order, and the gate is the only place that reports problems.
 */
function StepNav({ current, onSelect, onDone }: StepNavProps) {
  const t = useTranslations('Authoring');
  const previous = (current - 1) as IssueStep;
  const next = (current + 1) as IssueStep;

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        disabled={current === 1}
        onClick={() => onSelect(previous)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('errorCorrection.shell.navBack')}
      </Button>

      {current === 4 ? (
        <Button type="button" onClick={onDone}>
          {t('errorCorrection.shell.done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect(next)}>
          {t('errorCorrection.shell.navNext', {
            step: t(`errorCorrection.shell.step${next}` as 'errorCorrection.shell.step1'),
          })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useErrorCorrectionAutosave>['status'];
  savedAt: Date | null;
  canOverwrite: boolean;
  onRetry: () => void;
  onOverwrite: () => void;
}

/**
 * `Saving…` → `Saved`, and a way back when it fails. Announced, never colour alone.
 *
 * A conflict gets its own way out. Autosave stops there by design, so without one the
 * teacher is left with a screen full of work and nothing that will write it.
 */
function SaveHint({ status, savedAt, canOverwrite, onRetry, onOverwrite }: SaveHintProps) {
  const t = useTranslations('Authoring');

  if (status === 'conflict' || status === 'failed') {
    return (
      <span className="flex items-center gap-2 text-xs text-error" role="status">
        <CircleAlert className="size-3.5" aria-hidden />
        {status === 'conflict'
          ? t('errorCorrection.shell.saveConflict')
          : t('errorCorrection.shell.saveFailed')}
        {status === 'conflict' && canOverwrite ? (
          <Button type="button" variant="link" size="sm" onClick={onOverwrite}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('errorCorrection.shell.saveOverwrite')}
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('errorCorrection.shell.saveRetry')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('errorCorrection.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('errorCorrection.shell.saved', { time: savedAt.toLocaleTimeString() })}
    </span>
  );
}

/** One line of the gate, from either list — they are shown as one. */
interface GateLine {
  key: string;
  level: 'blocker' | 'warning' | 'info';
  step: IssueStep;
  text: string;
}

interface GateDialogProps {
  open: boolean;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  /** This template's own audio rule — a transcript that hands the exercise away. */
  givesAway: boolean;
  blockerCount: number;
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: IssueStep) => void;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first, then what is worth a second look, then the remarks. It is a report, not a state
 * change — readiness is decided by container pre-flight from the same rules — but the
 * button stays disabled while a blocker is listed, which is what the handoff asks of it.
 */
function GateDialog({
  open,
  problems,
  audioProblems,
  givesAway,
  blockerCount,
  onOpenChange,
  onGoToStep,
}: GateDialogProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy();
  const describeAudio = useAudioIssueCopy();

  // One list, not two: an author who switched listening on has one exercise to finish.
  const lines: GateLine[] = [
    ...problems.map((issue, index) => ({
      key: `own-${issue.code}-${index}`,
      level: issue.level,
      step: issue.step,
      text: describeIssue(issue),
    })),
    ...audioProblems.map((issue, index) => ({
      key: `audio-${issue.code}-${index}`,
      level: issue.level,
      step: issue.step as IssueStep,
      text: describeAudio(issue),
    })),
    ...(givesAway
      ? [
          {
            key: 'audio-gives-away',
            level: 'blocker' as const,
            step: AUDIO_STEPS.transcript as IssueStep,
            text: t('errorCorrection.audioGivesAway'),
          },
        ]
      : []),
  ];

  const ordered: GateLine[] = [
    ...lines.filter((line) => line.level === 'blocker'),
    ...lines.filter((line) => line.level === 'warning'),
    ...lines.filter((line) => line.level === 'info'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('errorCorrection.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {ordered.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('errorCorrection.shell.gateClear')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ordered.map((line) => (
              <li key={line.key}>
                <button
                  type="button"
                  onClick={() => onGoToStep(line.step)}
                  className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-[var(--ssz-bg-subtle)]"
                >
                  {line.level === 'blocker' ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                  ) : line.level === 'warning' ? (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning-700"
                      aria-hidden
                    />
                  ) : (
                    <CircleAlert
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block">{line.text}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('errorCorrection.shell.gateGoToStep', { step: line.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('errorCorrection.shell.gateClose')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('errorCorrection.shell.gateBlocked', { count: blockerCount })
              : t('errorCorrection.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
