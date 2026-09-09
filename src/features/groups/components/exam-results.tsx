'use client';

import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { examStats, gradeTone, type GradeTone } from '../lib/session-derive';
import type { RosterStudent, SessionScore } from '../types';

const BAR_TONE: Record<GradeTone, string> = {
  success: 'bg-success-500',
  primary: 'bg-primary-500',
  warn: 'bg-warning-500',
  danger: 'bg-error-500',
};

type Props = {
  roster: RosterStudent[];
  scores: SessionScore[];
  passMark: number;
  onChange: (scores: SessionScore[]) => void;
};

/**
 * Marks for one exam, student by student. An empty field means ungraded, never
 * zero: a student who did not sit the exam must not drag the average down, and
 * must not count against the pass rate either.
 */
export function ExamResults({ roster, scores, passMark, onChange }: Props) {
  const t = useTranslations('Groups');
  const byStudent = new Map(scores.map((s) => [s.studentId, s.score]));
  // Marks are kept by student id, so somebody who left the group simply drops
  // out of the table — and out of the average — while their mark survives.
  const stats = examStats(
    roster.map((s) => ({ studentId: s.userId, score: byStudent.get(s.userId) ?? null })),
    passMark,
  );

  function setScore(studentId: string, raw: string) {
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? null : Math.max(0, Math.min(100, Math.round(Number(trimmed))));
    const score = parsed !== null && Number.isNaN(parsed) ? null : parsed;
    onChange([
      ...scores.filter((s) => s.studentId !== studentId),
      { studentId, score },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-baseline gap-4">
          <span>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-(--ssz-text-muted)">
              {t('schedule.average')}
            </span>
            <span className="text-[20px] font-bold tabular-nums text-(--ssz-text-primary)">
              {stats.average === null ? '—' : `${stats.average}%`}
            </span>
          </span>
          <span>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-(--ssz-text-muted)">
              {t('schedule.passed')}
            </span>
            <span className="text-[20px] font-bold tabular-nums text-(--ssz-text-primary)">
              {stats.passed}/{stats.graded}
            </span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              stats.average === null ? 'bg-muted' : BAR_TONE[gradeTone(stats.average)],
            )}
            style={{ width: `${stats.average ?? 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-(--ssz-text-muted)">
          {t('schedule.passMark', { n: passMark })}
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-(--ssz-text-muted)">
          {t('schedule.noStudents')}
        </p>
      ) : (
        <ul className="max-h-[240px] overflow-y-auto rounded-lg border border-border">
          {roster.map((student) => {
            const score = byStudent.get(student.userId) ?? null;
            return (
              <li
                key={student.userId}
                className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0"
              >
                <Avatar name={student.name} src={student.avatarUrl ?? undefined} size="sm" />
                <span className="min-w-0 flex-1 truncate text-xs text-(--ssz-text-primary)">
                  {student.name}
                </span>
                {score !== null && (
                  <Badge variant={score >= passMark ? 'success' : 'error'}>
                    {score >= passMark ? t('schedule.pass') : t('schedule.fail')}
                  </Badge>
                )}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={score ?? ''}
                  onChange={(e) => setScore(student.userId, e.target.value)}
                  aria-label={t('schedule.scoreFor', { name: student.name })}
                  className="w-[68px] text-center"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
