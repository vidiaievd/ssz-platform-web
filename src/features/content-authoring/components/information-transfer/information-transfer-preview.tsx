'use client';

import { useMemo, useState } from 'react';
import { Eye, List, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import {
  InformationTransferBody,
  InformationTransferReaderCard,
  PRACTICE_ACCENT,
  type InformationTransferPhase,
  type InformationTransferValues,
} from '@/features/student/exercises/runner';
import type { InformationTransferSubmitDetails } from '@/features/student/exercises/types/attempts';
import { transcriptOnReveal, withStudentAudio } from '@/lib/shared-kernel/audio';
import {
  check,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type CheckResult,
} from '@/lib/shared-kernel/information-transfer';

import type { InformationTransferDocument } from './edits';

type Device = 'phone' | 'desktop' | 'reader';

/** The desktop body's own width in the prototype's preview. */
const DESKTOP_MIN = 620;

export interface InformationTransferPreviewProps {
  exercise: InformationTransferDocument;
}

/**
 * The student's view of the blank being built — the runner's own body, not a lookalike
 * (INF-B29), fed through `toStudentProjection`, which is what drops the key, the reasons, the
 * pass mark and the unfinished fields (plan 73 §7.8).
 *
 * **The verdict is real.** *Live* runs the kernel's `check` — the function the engine calls —
 * in the teacher's browser, which holds the key anyway (plan 73 §3.10), with the budget, the
 * frozen cells and the reveal as the server applies them, and shapes the result the way the
 * engine's answer is shaped, so the body cannot tell the two apart. The clip is the layer's
 * player over the author's own block. Nothing leaves the browser and nothing is recorded.
 *
 * Three devices — phone, desktop and the reader's card — and *Static* (everything drawn,
 * nothing accepts input) or *Live*, with «Restart the attempt» (deviation 24).
 */
export function InformationTransferPreview({ exercise }: InformationTransferPreviewProps) {
  const t = useTranslations('Authoring.informationTransfer.preview');

  const [device, setDevice] = useState<Device>('phone');
  const [mode, setMode] = useState<'static' | 'live'>('live');
  /** Bumped by every restart, so the body — its step and its audio gate — starts afresh. */
  const [round, setRound] = useState(0);

  const content = useMemo(() => toContent(exercise), [exercise]);
  const projection = useMemo(
    () => toStudentProjection(content, toExpectedAnswers(exercise)),
    [content, exercise],
  );
  // What the engine delivers for the clip: the block with its transcript dosed and a timecode per
  // cell — so the fragments and the listening limit behave as they will for the student.
  const delivered = useMemo(
    () => withStudentAudio({}, content as unknown as Record<string, unknown>, TEMPLATE_CODE),
    [content],
  );
  const audio = useExerciseAudio(delivered, { simulate: true });

  const [values, setValues] = useState<InformationTransferValues>({});
  const [phase, setPhase] = useState<InformationTransferPhase>('answering');
  const [verdict, setVerdict] = useState<InformationTransferSubmitDetails | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [firstValues, setFirstValues] = useState<Record<string, string> | undefined>(undefined);
  const [attempt, setAttempt] = useState(1);
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );

  /*
    When what the student would be handed changes, the attempt starts again — during render,
    not in an effect, so no frame shows a verdict over a blank that just changed. The key and the
    reasons are not in the signature on purpose: rewording a reason should not wipe a check the
    author is looking at; the next check reads the new key anyway.
  */
  const signature = JSON.stringify([projection, exercise.grading, exercise.scoring]);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    restart();
  }

  function restart() {
    setValues({});
    setPhase('answering');
    setVerdict(null);
    setLocked([]);
    setFirstValues(undefined);
    setAttempt(1);
    setTranscript(null);
    setRound((n) => n + 1);
  }

  function change(key: string, value: string) {
    if (locked.includes(key)) return;
    setValues((current) => {
      const next = { ...current };
      if (value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function send() {
    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim() !== '') answers[key] = value;
    }
    const result = check({
      ex: exercise,
      answers,
      attempt,
      locked,
      ...(firstValues === undefined ? {} : { firstValues }),
    });
    setVerdict(detailsOf(result));
    setLocked(result.locked);
    setFirstValues(result.firstValues);
    setAttempt(result.attempt);
    setPhase('checked');
    // The `after` transcript comes with the closing check, as the engine sends it (deviation 16).
    if (result.closed) setTranscript(transcriptOnReveal(content));
  }

  /** «Rett opp N felt»: exactly the cells the last check did not count are emptied. */
  function retry() {
    if (verdict === null) return;
    const wrong = new Set(
      verdict.items
        .filter((item) => !item.correct && values[item.itemId] === item.value)
        .map((item) => item.itemId),
    );
    setValues((current) => {
      const next: InformationTransferValues = {};
      for (const [key, value] of Object.entries(current)) {
        if (!wrong.has(key) || locked.includes(key)) next[key] = value;
      }
      return next;
    });
    setAttempt(verdict.attempt + 1);
    setVerdict(null);
    setPhase('answering');
  }

  const interactive = mode === 'live';

  const body =
    device === 'reader' ? (
      <InformationTransferReaderCard
        projection={projection}
        title={exercise.title}
        plays={exercise.audio.settings.plays}
        fragments={exercise.audio.useSegments}
        interactive={interactive}
        onStart={() => setDevice('phone')}
        accent={PRACTICE_ACCENT}
      />
    ) : (
      <InformationTransferBody
        key={round}
        projection={projection}
        title={exercise.title}
        values={values}
        onValueChange={change}
        phase={phase}
        verdict={verdict}
        locked={locked}
        attempt={attempt}
        interactive={interactive}
        layout={device}
        onCheck={send}
        onRetry={retry}
        onNewRound={restart}
        accent={PRACTICE_ACCENT}
        audio={audio}
        audioTranscript={transcript}
      />
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--ssz-border-default) px-3 py-2">
        <Eye size={15} aria-hidden="true" className="text-(--ssz-text-muted)" />
        <strong className="text-xs font-bold tracking-wide text-(--ssz-text-muted) uppercase">
          {t('title')}
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
            { value: 'reader', label: t('reader'), icon: List },
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
          {device === 'desktop' ? (
            <div style={{ minWidth: DESKTOP_MIN }}>{body}</div>
          ) : (
            <div className="mx-auto max-w-[390px]">{body}</div>
          )}
        </div>
      </div>
      <p className="m-0 px-4 pb-3 text-[11px] text-(--ssz-text-muted)">
        {interactive ? t('noteLive') : t('noteStatic')}
      </p>
    </div>
  );
}

/**
 * The kernel's result in the shape the engine sends — the allowlist of the engine's
 * `learnerFacingDetails`: per cell the value, the verdict and whether it counts, the standard
 * form or the key only where it may be shown, the reason on a cell not counted, the hint once
 * it is out. No first values of other cells, nothing internal.
 */
function detailsOf(result: CheckResult): InformationTransferSubmitDetails {
  return {
    totalItems: result.total,
    passedItems: result.correct,
    correctNow: result.correctNow,
    pct: result.pct,
    passed: result.passed,
    passPct: result.passPct,
    missedRequired: result.missedRequired,
    attempt: result.attempt,
    checksLeft: result.checksLeft,
    closed: result.closed,
    revealed: result.revealed,
    locked: result.locked,
    items: result.cells.map((cell) => ({
      itemId: cell.id,
      value: cell.value,
      verdict: cell.verdict,
      correct: cell.ok,
      ...(cell.canonical === undefined ? {} : { canonical: cell.canonical }),
      ...(cell.why === undefined ? {} : { why: cell.why }),
      ...(cell.hint === undefined ? {} : { hint: cell.hint }),
    })),
  };
}
