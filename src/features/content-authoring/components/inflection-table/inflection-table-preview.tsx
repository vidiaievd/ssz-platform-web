'use client';

import { useMemo, useState } from 'react';
import { Eye, Monitor, RotateCcw, Smartphone, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import {
  InflectionTableBody,
  InflectionTableReaderCard,
  PRACTICE_ACCENT,
  type InflectionTablePhase,
  type InflectionTableValues,
} from '@/features/student/exercises/runner';
import type { InflectionTableSubmitDetails } from '@/features/student/exercises/types/attempts';
import { applyAudioDraft } from '@/lib/shared-kernel/audio';
import {
  check,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type CheckResult,
} from '@/lib/shared-kernel/inflection-table';

import type { InflectionTableDocument } from './edits';

type Device = 'phone' | 'desktop' | 'reader';

/** The desktop body's own width in the prototype's preview. */
const DESKTOP_MIN = 620;

export interface InflectionTablePreviewProps {
  exercise: InflectionTableDocument;
}

/**
 * The student's view of the table being built — the runner's own body, not a lookalike
 * (IT-X4), fed through `toStudentProjection`, which is what drops the key and the unfinished
 * rows (plan 69 §7.7).
 *
 * **The verdict is real.** It runs the kernel's `check` — the function the engine calls — in the
 * teacher's browser, which holds the key anyway (precedent: plans 54, 66–68), and shapes the
 * result the way the engine's answer is shaped, so the body cannot tell the two apart. It is not
 * an attempt: nothing is recorded.
 *
 * Three devices — phone, desktop and the reader's card (Q4) — and *Static* (everything drawn,
 * nothing accepts input) or *Live*. The bank is dealt in the author's order here: the server's
 * per-attempt shuffle is the student's, and a preview that reshuffled on every keystroke would
 * not be a preview of one table.
 */
export function InflectionTablePreview({ exercise }: InflectionTablePreviewProps) {
  const t = useTranslations('Authoring.inflectionTable.preview');

  const [device, setDevice] = useState<Device>('phone');
  const [mode, setMode] = useState<'static' | 'live'>('live');

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
  const audio = useExerciseAudio(withAudio, { simulate: true });

  const [values, setValues] = useState<InflectionTableValues>({});
  const [phase, setPhase] = useState<InflectionTablePhase>('answering');
  const [verdict, setVerdict] = useState<InflectionTableSubmitDetails | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [firstValues, setFirstValues] = useState<Record<string, string> | undefined>(undefined);
  const [attempt, setAttempt] = useState(1);

  /*
    When what the student would be handed changes, the attempt starts again — during render,
    not in an effect, so no frame shows a verdict over a table that just changed. The key and the
    reasons are not in the signature on purpose: rewording a reason should not wipe a check the
    author is looking at; the next check reads the new key anyway.
  */
  const signature = JSON.stringify([projection, exercise.settings, exercise.input]);
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
  }

  function change(key: string, value: string | null) {
    if (locked.includes(key)) return;
    setValues((current) => {
      const next = { ...current };
      if (value === null || value === '') delete next[key];
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
  }

  /** «Prøv de gale på nytt»: exactly the cells the last check found wrong are emptied. */
  function retry() {
    if (verdict === null) return;
    const wrong = new Set(
      verdict.items
        .filter((item) => !item.correct && values[item.itemId] === item.value)
        .map((item) => item.itemId),
    );
    setValues((current) => {
      const next: InflectionTableValues = {};
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
    projection.rows.length === 0 ? (
      <p className="m-0 text-sm text-(--ssz-text-muted)">{t('empty')}</p>
    ) : device === 'reader' ? (
      <InflectionTableReaderCard
        projection={projection}
        title={exercise.title}
        interactive={interactive}
        onStart={() => setDevice('phone')}
        accent={PRACTICE_ACCENT}
      />
    ) : (
      <InflectionTableBody
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

/**
 * The kernel's result in the shape the engine sends: the same facts under the names the
 * runner reads (`correct` → `correctForm`, the cell's first form → `firstAnswer`).
 */
function detailsOf(result: CheckResult): InflectionTableSubmitDetails {
  return {
    totalItems: result.total,
    passedItems: result.correct,
    correctNow: result.correctNow,
    falsePositives: result.falsePositives,
    pct: result.pct,
    passed: result.passed,
    attempt: result.attempt,
    checksLeft: result.checksLeft,
    closed: result.closed,
    locked: result.locked,
    rows: result.rows.map((row) => ({
      rowId: row.rowId,
      asked: row.asked,
      ok: row.ok,
      firstOk: row.firstOk,
    })),
    items: result.cells.map((cell) => ({
      itemId: cell.key,
      rowId: cell.rowId,
      slotId: cell.slotId,
      value: cell.value,
      correct: cell.ok,
      firstCorrect: cell.firstOk,
      firstAnswer: result.firstValues[cell.key] ?? cell.value,
      ...(cell.near === undefined ? {} : { near: cell.near }),
      ...(cell.why === undefined ? {} : { why: cell.why }),
      ...(cell.correct === undefined ? {} : { correctForm: cell.correct }),
    })),
  };
}
