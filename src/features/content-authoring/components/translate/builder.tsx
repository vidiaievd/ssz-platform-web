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
  type Issue,
  type IssueStep,
  type Translate,
} from '@/lib/shared-kernel/translate';
import type { LevelGrammarRule } from '@/features/content-authoring/lib/level-grammar-rules';

import type { AudioDraft, AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { useAudioIssueCopy, useAudioProblems } from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepCheck } from './step-check';
import { StepDirection } from './step-direction';
import { StepFlow } from './step-flow';
import { StepSentences } from './step-sentences';
import { useTranslateAutosave } from './use-translate-autosave';
import { useIssueCopy } from './issue-copy';

/** The four steps of the rail, in authoring order. */
const BUILT_STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * Where this builder keeps each part of the audio layer.
 *
 * The clip and the per-sentence recordings both belong to step 2, which is where the
 * sentences are — a recording is *of* a sentence here, more literally than anywhere else.
 * The rules go to step 4, beside the rest of how the exercise runs, and the transcript
 * with them; under per-sentence recordings there is no transcript to write, because the
 * sentence the recording speaks is the one on screen.
 */
const AUDIO_STEPS: AudioStepMap = { source: 2, segments: 2, rules: 4, transcript: 4 };

export interface TranslateBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The grammar rules of this Leksjon, for step 4's "what does this practise" panel. */
  grammarRules?: LevelGrammarRule[];
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: Translate;
  /**
   * The listening layer as the stored document carries it — a sibling of the document,
   * because the kernel's `Translate` is shared with the services (plan 56 phase 6).
   */
  initialAudio: AudioDraft;
  /**
   * Reports every edit so the shell's preview column can render the student's view of the
   * document being written.
   */
  onDocumentChange?: (exercise: Translate) => void;
  /**
   * Every successful save, with the token the row now carries. The shell uses it to keep
   * its cached copy current: a cache holding a superseded token is a conflict the next
   * time this builder mounts from it.
   */
  onSavedRemote?: (updatedAt: string, saved: Translate, audio: AudioDraft) => void;
}

/**
 * The translate builder: one document, authored in steps (BEHAVIOR.md, "Конструктор").
 *
 * The rail is not a wizard. Every step is reachable at any time because authoring is not
 * linear — the sentences written in step 2 are what the check settings are read against,
 * and the author moves between them. What the rail carries instead of a lock is the
 * kernel's `stepState`: which step has a blocker, which has something worth a second look,
 * and which is simply empty.
 *
 * Instructions live in the document rather than beside it, because `issues()` reads them
 * to decide whether step 1 is done.
 */
export function TranslateBuilder({
  exerciseId,
  containerId,
  grammarRules,
  initialExercise,
  initialAudio,
  onDocumentChange,
  onSavedRemote,
}: TranslateBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [audio, setAudio] = useState(initialAudio);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useTranslateAutosave({
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

  const problems = useMemo(() => issues(exercise), [exercise]);
  const blockers = problems.filter((issue) => issue.level === 'blocker');

  /**
   * The layer's findings, in the same rail and the same gate as the type's own.
   *
   * The items carry their recordings, not just their ids: under `source: 'items'` what
   * makes the exercise playable is that some sentence has one, and only the document
   * knows that.
   */
  const audioProblems = useAudioProblems(
    audio,
    exercise.items.map((item) => ({
      id: item.id,
      ...(item.mediaId ? { clip: item.mediaId } : {}),
    })),
    AUDIO_STEPS,
  );
  const audioBlockers = audioProblems.filter((issue) => issue.level === 'blocker');

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 items-stretch justify-between gap-3">
          <TranslateSteps
            current={step}
            exercise={exercise}
            audioProblems={audioProblems}
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
              {t('translate.shell.done')}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 2 ? (
          <StepSentences
            exercise={exercise}
            onChange={setExercise}
            audio={audio}
            onAudioChange={setAudio}
          />
        ) : step === 3 ? (
          <StepCheck exercise={exercise} onChange={setExercise} />
        ) : step === 4 ? (
          <StepFlow
            exercise={exercise}
            onChange={setExercise}
            grammarRules={grammarRules}
            audio={audio}
            onAudioChange={setAudio}
          />
        ) : (
          <StepDirection exercise={exercise} onChange={setExercise} />
        )}

        <StepNav current={step} onSelect={setStep} onDone={() => setGateOpen(true)} />
      </div>

      <GateDialog
        open={gateOpen}
        problems={problems}
        audioProblems={audioProblems}
        blockerCount={blockers.length + audioBlockers.length}
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
function TranslateSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: Translate;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = BUILT_STEPS.map((step) => {
    const own = stepState(exercise, step);
    // A step is as bad as its worst finding, whichever list it came from: listening
    // switched on with nothing to play is a blocker exactly as a missing key is, and a
    // rail that counted only the type's own would show green over an exercise the
    // server's preflight refuses.
    const here = audioProblems.filter((issue) => issue.step === step);
    const audioBlockers = here.filter((issue) => issue.level === 'blocker').length;
    const state =
      audioBlockers > 0
        ? 'err'
        : here.some((issue) => issue.level === 'warning') && own.state !== 'err'
          ? 'warn'
          : own.state;
    const blockers = (own.state === 'err' ? own.blockers : 0) + audioBlockers;

    return {
      n: step,
      label: t(`translate.shell.step${step}` as 'translate.shell.step1'),
      sub: t(`translate.shell.stepSub${step}` as 'translate.shell.stepSub1'),
      ...(state === 'err'
        ? {
            status: 'blockers' as const,
            blockers,
            statusLabel: t('translate.shell.blockerCount', { count: blockers }),
          }
        : state === 'warn'
          ? { status: 'warn' as const, statusLabel: t('translate.shell.stepCheck') }
          : state === 'empty'
            ? { status: 'empty' as const, statusLabel: t('translate.shell.stepEmpty') }
            : { status: 'ok' as const, statusLabel: t('translate.shell.stepOk') }),
    };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={t('translate.shell.stepsLabel')}
    />
  );
}

interface StepNavProps {
  current: IssueStep;
  onSelect: (step: IssueStep) => void;
  onDone: () => void;
}

/** The way forward at the bottom of a step, so the author does not travel back to the rail. */
function StepNav({ current, onSelect, onDone }: StepNavProps) {
  const t = useTranslations('Authoring');
  const last = BUILT_STEPS[BUILT_STEPS.length - 1];

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        disabled={current === BUILT_STEPS[0]}
        onClick={() => onSelect((current - 1) as IssueStep)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('translate.shell.navBack')}
      </Button>

      {current === last ? (
        <Button type="button" onClick={onDone}>
          {t('translate.shell.done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect((current + 1) as IssueStep)}>
          {t('translate.shell.navNext', {
            step: t(`translate.shell.step${(current + 1) as IssueStep}` as 'translate.shell.step1'),
          })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useTranslateAutosave>['status'];
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
          ? t('translate.shell.saveConflict')
          : t('translate.shell.saveFailed')}
        {status === 'conflict' && canOverwrite ? (
          <Button type="button" variant="link" size="sm" onClick={onOverwrite}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('translate.shell.saveOverwrite')}
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('translate.shell.saveRetry')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('translate.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('translate.shell.saved', { time: savedAt.toLocaleTimeString() })}
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
  blockerCount: number;
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: IssueStep) => void;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first, then what is worth a second look, then the remarks. It is a report rather than a
 * state change — readiness is decided by container pre-flight from the same rules — but
 * the button stays disabled while a blocker is listed.
 *
 * Every problem carries the step that owns the fix, so every row is a way there.
 */
function GateDialog({
  open,
  problems,
  audioProblems,
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
          <DialogTitle>{t('translate.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {ordered.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('translate.shell.gateClear')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ordered.map((line) => {
              const icon =
                line.level === 'blocker' ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                ) : line.level === 'warning' ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
                ) : (
                  <CircleAlert
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                );

              return (
                <li key={line.key}>
                  <button
                    type="button"
                    onClick={() => onGoToStep(line.step)}
                    className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-[var(--ssz-bg-subtle)]"
                  >
                    {icon}
                    <span>
                      <span className="block">{line.text}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t('translate.shell.gateGoToStep', { step: line.step })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('translate.shell.gateClose')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('translate.shell.gateBlocked', { count: blockerCount })
              : t('translate.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
