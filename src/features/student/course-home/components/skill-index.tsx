import {
  PenLine,
  BookOpen,
  Headphones,
  Mic,
  Book,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { SkillMastery } from '@/features/learning';

/* ── Skill config ────────────────────────────────────────────────── */

const SKILL_CONFIG: Record<string, { label: string; Icon: LucideIcon }> = {
  grammar:    { label: 'Grammar',    Icon: PenLine },
  vocabulary: { label: 'Vocabulary', Icon: BookOpen },
  listening:  { label: 'Listening',  Icon: Headphones },
  speaking:   { label: 'Speaking',   Icon: Mic },
  reading:    { label: 'Reading',    Icon: Book },
  writing:    { label: 'Writing',    Icon: Pencil },
};

/* ── Mastery color ───────────────────────────────────────────────── */

function masteryColor(pct: number): string {
  if (pct >= 70) return 'var(--ssz-color-success-500)';
  if (pct >= 50) return 'var(--ssz-color-primary-500)';
  return 'var(--ssz-color-warning-500)';
}

function masteryBg(pct: number): string {
  if (pct >= 70) return 'var(--ssz-color-success-100)';
  if (pct >= 50) return 'var(--ssz-color-primary-100)';
  return 'var(--ssz-color-warning-100)';
}

/* ── Skill row ───────────────────────────────────────────────────── */

interface SkillRowProps {
  skill: SkillMastery;
  courseHref: string;
}

function SkillRow({ skill, courseHref }: SkillRowProps) {
  const t = useTranslations('Learning.courseHome.skillIndex');

  const config = SKILL_CONFIG[skill.skill.toLowerCase()];
  const label = config?.label ?? skill.skill;
  const Icon = config?.Icon ?? BookOpen;
  const pct = Math.round(skill.masteryPercent);
  const color = masteryColor(pct);
  const tileBg = masteryBg(pct);

  return (
    <a
      href={`${courseHref}?skill=${encodeURIComponent(skill.skill)}`}
      className="group flex items-center gap-4 rounded-xl border p-4 transition-all duration-150"
      style={{
        borderColor: 'var(--ssz-border-default)',
        background: 'var(--ssz-bg-surface)',
        boxShadow: 'var(--ssz-shadow-xs)',
        textDecoration: 'none',
      }}
      aria-label={`${label}: ${t('mastery', { pct })}`}
    >
      {/* Icon tile */}
      <div
        className="flex shrink-0 items-center justify-center rounded-xl"
        style={{ width: 40, height: 40, background: tileBg }}
        aria-hidden="true"
      >
        <Icon size={18} style={{ color }} />
      </div>

      {/* Text + bar */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {label}
          </span>
          <span className="shrink-0 text-sm font-bold" style={{ color }}>
            {pct}%
          </span>
        </div>
        {/* Progress bar */}
        <div
          className="mt-1.5 overflow-hidden rounded-full"
          style={{ height: 5, background: 'var(--ssz-bg-muted)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('mastery', { pct })}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>

      {/* Jump arrow */}
      <span
        className="shrink-0 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--ssz-text-muted)' }}
        aria-hidden="true"
      >
        {t('jump')}
      </span>
    </a>
  );
}

/* ── SkillIndex ──────────────────────────────────────────────────── */

export interface SkillIndexProps {
  skills: SkillMastery[];
  courseHref: string;
}

export function SkillIndex({ skills, courseHref }: SkillIndexProps) {
  const t = useTranslations('Learning.courseHome.skillIndex');

  if (skills.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--ssz-text-muted)' }}>
        {t('noData')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="list" aria-label="Skill index">
      {skills.map((skill) => (
        <div key={skill.skill} role="listitem">
          <SkillRow skill={skill} courseHref={courseHref} />
        </div>
      ))}
    </div>
  );
}
