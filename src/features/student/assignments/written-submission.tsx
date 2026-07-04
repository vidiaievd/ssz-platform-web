'use client';

import { useEffect, useRef, useState } from 'react';

import { CheckCircle, Eye, Pencil, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useSubmitWrittenAssignment } from '@/features/learning/api/use-assignments';
import type { Assignment, AssignmentStatus } from '@/features/learning/types';

/* ── Draft persistence key ─────────────────────────────────── */
function draftKey(id: string) {
  return `ssz_assignment_draft_${id}`;
}

/* ── Submission timeline ───────────────────────────────────── */
type StepState = 'done' | 'current' | 'todo';

interface TimelineStep {
  key: string;
  label: string;
  icon: React.ReactNode;
  state: StepState;
}

const STEP_INDEX: Partial<Record<AssignmentStatus, number>> = {
  submitted: 0,
  'in-review': 1,
  returned: 2,
  completed: 3,
};

function SubmissionTimeline({ status }: { status: AssignmentStatus }) {
  const t = useTranslations('Assignments.written.step');
  const isReturned = status === 'returned';
  const curIdx = STEP_INDEX[status] ?? 0;

  const steps: TimelineStep[] = [
    { key: 'submitted', label: t('submitted'), icon: <Upload size={15} />, state: 'todo' },
    { key: 'inReview',  label: t('inReview'),  icon: <Eye size={15} />,    state: 'todo' },
    {
      key: 'feedback',
      label: isReturned ? t('returnedLabel') : t('feedback'),
      icon: <Pencil size={15} />,
      state: 'todo',
    },
    {
      key: 'done',
      label: isReturned ? t('resubmitLabel') : t('done'),
      icon: <CheckCircle size={15} />,
      state: 'todo',
    },
  ].map((s, i) => ({
    ...s,
    state: (isReturned && i === 2
      ? 'current'
      : i < curIdx
        ? 'done'
        : i === curIdx
          ? 'current'
          : 'todo') as StepState,
  }));

  return (
    <div className="flex items-start gap-0">
      {steps.map((s, i) => {
        const isDone    = s.state === 'done';
        const isCurrent = s.state === 'current';
        const isTodo    = s.state === 'todo';
        const color = isDone
          ? 'var(--ssz-color-success-500)'
          : isCurrent
            ? isReturned && i === 2 ? 'oklch(0.57 0.105 82)' : 'var(--ssz-color-primary-500)'
            : 'var(--ssz-border-strong)';
        const filled = !isTodo;
        const glowColor = isCurrent
          ? isReturned && i === 2 ? 'oklch(0.57 0.105 82)' : 'var(--ssz-color-primary-500)'
          : undefined;

        return (
          <div key={s.key} className="flex flex-1 items-start">
            <div className="flex flex-col items-center gap-2" style={{ minWidth: 78 }}>
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
                style={{
                  background: filled ? color : 'var(--ssz-bg-base)',
                  border: filled ? 'none' : '2px solid var(--ssz-border-strong)',
                  color: filled ? '#fff' : 'var(--ssz-text-muted)',
                  boxShadow: isCurrent && glowColor ? `0 0 0 4px ${glowColor}22` : undefined,
                  transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
                }}
                aria-label={`${s.label} — ${s.state}`}
              >
                {isDone ? <CheckCircle size={15} aria-hidden /> : s.icon}
              </span>
              <span
                className="text-center text-[11.5px] leading-tight"
                style={{
                  fontWeight: isCurrent ? 700 : 500,
                  color: isTodo ? 'var(--ssz-text-muted)' : 'var(--ssz-text-primary)',
                }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mt-[17px] h-0.5 flex-1 rounded-sm"
                style={{
                  background: i < curIdx ? 'var(--ssz-color-success-500)' : 'var(--ssz-border-default)',
                  transition: 'background 220ms cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Card wrapper ──────────────────────────────────────────── */
function Card({
  children,
  style,
  className = '',
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'var(--ssz-bg-surface)',
        border: '1.5px solid var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-xs)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Written submission ─────────────────────────────────────── */
interface WrittenSubmissionProps {
  assignment: Assignment;
  onExit: () => void;
}

export function WrittenSubmission({ assignment: a, onExit }: WrittenSubmissionProps) {
  const t = useTranslations('Assignments.written');
  const [draftText, setDraftText] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(draftKey(a.id)) ?? '';
  });
  const [optimisticStatus, setOptimisticStatus] = useState<AssignmentStatus>(a.status);
  const submitMutation = useSubmitWrittenAssignment(a.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Focus textarea when status is active */
  useEffect(() => {
    if (optimisticStatus === 'active') textareaRef.current?.focus();
  }, [optimisticStatus]);

  function wordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  function saveDraft() {
    localStorage.setItem(draftKey(a.id), draftText);
    onExit();
  }

  async function handleSubmit() {
    if (!draftText.trim()) return;
    setOptimisticStatus('submitted');
    try {
      await submitMutation.mutateAsync({ text: draftText });
      localStorage.removeItem(draftKey(a.id));
    } catch {
      setOptimisticStatus(a.status);
    }
  }

  const words = wordCount(draftText);
  const canSubmit = words > 0;
  const status = optimisticStatus;

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5">
      {/* Brief card */}
      <Card className="p-[22px_24px]">
        <div className="mb-3.5 flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: 'oklch(0.67 0.11 82 / 0.11)' }}
            aria-hidden
          >
            <Pencil size={19} style={{ color: 'oklch(0.57 0.105 82)' }} />
          </span>
          <div className="flex-1">
            <h2
              className="text-[17px] font-bold tracking-[-0.01em]"
              style={{ color: 'var(--ssz-text-primary)' }}
            >
              {a.title}
            </h2>
            <p className="text-[12.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
              {a.module} · {a.skill} · {a.teacher}
            </p>
          </div>
        </div>
        <p
          className="rounded-[10px] p-[12px_14px] text-[14px] leading-[1.6]"
          style={{
            background: 'var(--ssz-bg-subtle)',
            color: 'var(--ssz-text-secondary)',
          }}
        >
          {a.brief}
        </p>
      </Card>

      {/* Timeline card */}
      <Card className="p-[24px_26px_20px]">
        <p
          className="mb-[18px] text-[11px] font-bold uppercase tracking-[0.07em]"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          {t('timelineLabel')}
        </p>
        <SubmissionTimeline status={status} />
      </Card>

      {/* State-specific body */}
      {status === 'active' && (
        <Card className="p-[22px_24px]">
          <p className="mb-2.5 text-[13px] font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
            Your answer
          </p>
          <textarea
            ref={textareaRef}
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            placeholder="Write your response here…"
            rows={6}
            className="w-full resize-y rounded-xl px-4 py-3.5 text-[15px] leading-[1.6] outline-none"
            style={{
              fontFamily: 'var(--ssz-font-reading)',
              border: '1.5px solid var(--ssz-border-default)',
              background: 'var(--ssz-bg-base)',
              color: 'var(--ssz-text-primary)',
            }}
            aria-label="Your written answer"
          />
          <div className="mt-3.5 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: 'var(--ssz-text-muted)' }}>
              {canSubmit
                ? t('wordCount', { count: words })
                : t('wordHint', { min: 60, max: 80 })}
            </span>
            <div className="flex gap-2.5">
              <Button variant="ghost" onClick={saveDraft}>{t('saveDraft')}</Button>
              <Button
                variant="primary"
                size="lg"
                disabled={!canSubmit || submitMutation.isPending}
                onClick={() => void handleSubmit()}
              >
                <Upload size={15} aria-hidden />
                {t('submit')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {status === 'submitted' && (
        <Card className="p-[20px_24px]">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} style={{ color: 'var(--ssz-color-success-500)' }} aria-hidden />
            <div className="flex-1">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
                {t('stateSubmitted', { time: a.submittedAt ?? 'just now' })}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ssz-text-secondary)' }}>
                {t('stateSubmittedSub')}
              </p>
            </div>
            <Button variant="ghost" onClick={onExit}>{t('done')}</Button>
          </div>
        </Card>
      )}

      {status === 'in-review' && (
        <Card className="p-[20px_24px]">
          <div className="flex items-center gap-3">
            <Eye size={20} style={{ color: 'oklch(0.57 0.105 82)' }} aria-hidden />
            <div className="flex-1">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
                {t('stateInReview', { teacher: a.teacher })}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ssz-text-secondary)' }}>
                {t('stateInReviewSub')}
              </p>
            </div>
            <Button variant="ghost" onClick={onExit}>{t('done')}</Button>
          </div>
        </Card>
      )}

      {status === 'returned' && (
        <Card
          className="p-[22px_24px]"
          style={{
            border: '1.5px solid oklch(0.86 0.08 82)',
            background: 'oklch(0.985 0.018 82)',
          }}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <Pencil size={17} style={{ color: 'oklch(0.46 0.09 82)' }} aria-hidden />
            <p className="text-[14px] font-bold" style={{ color: 'oklch(0.40 0.08 82)' }}>
              {t('stateReturned', { teacher: a.teacher })}
            </p>
          </div>
          {a.feedback && (
            <p
              className="mb-[18px] text-[14px] leading-[1.6]"
              style={{ color: 'var(--ssz-text-primary)' }}
            >
              {a.feedback}
            </p>
          )}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={onExit}>{t('later')}</Button>
            <Button variant="secondary" size="lg" onClick={onExit}>
              <Pencil size={15} aria-hidden />
              {t('reviseResubmit')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
