import { useTranslations } from 'next-intl';

import type { CourseInfo, CourseProgress } from '@/features/learning';

/* ── Language → hue mapping (OKLCH) for accent bar ───────────────── */
const LANG_HUE: Record<string, number> = {
  nb: 168,
  no: 168,
  en: 250,
  fr: 28,
  de: 75,
  es: 168,
};

/** Also used by the reader shell breadcrumb/sidebar (features/student/reader). */
export const LANG_EMOJI: Record<string, string> = {
  nb: '🇳🇴',
  no: '🇳🇴',
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
};

/* ── Ring Progress SVG ───────────────────────────────────────────── */

interface RingProgressProps {
  pct: number;
  hue: number;
}

function RingProgress({ pct, hue }: RingProgressProps) {
  const t = useTranslations('Learning.courseHome');
  const r = 29;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(pct, 100) / 100);
  const trackColor = 'var(--ssz-bg-subtle)';
  const fillColor = `oklch(0.62 0.105 ${hue})`;

  return (
    <svg
      width={72}
      height={72}
      viewBox="0 0 72 72"
      role="img"
      aria-label={`${pct}% ${t('complete')}`}
      className="shrink-0"
    >
      {/* Track */}
      <circle
        cx={36}
        cy={36}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={7}
      />
      {/* Progress */}
      <circle
        cx={36}
        cy={36}
        r={r}
        fill="none"
        stroke={fillColor}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* Center text */}
      <text
        x={36}
        y={33}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '15px',
          fontWeight: 700,
          fill: 'var(--ssz-text-primary)',
          fontFamily: 'var(--ssz-font-sans)',
        }}
      >
        {Math.round(pct)}%
      </text>
      <text
        x={36}
        y={47}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '10px',
          fill: 'var(--ssz-text-muted)',
          fontFamily: 'var(--ssz-font-sans)',
        }}
      >
        {t('complete')}
      </text>
    </svg>
  );
}

/* ── CourseHeader ────────────────────────────────────────────────── */

export interface CourseHeaderProps {
  courseInfo: CourseInfo;
  progress: CourseProgress;
}

export function CourseHeader({ courseInfo, progress }: CourseHeaderProps) {
  const t = useTranslations('Learning.courseHome');

  const hue = LANG_HUE[courseInfo.targetLanguage] ?? 168;
  const accentColor = `oklch(0.62 0.105 ${hue})`;
  const emoji = LANG_EMOJI[courseInfo.targetLanguage] ?? '📚';
  const { completedLessons, totalLessons, percentComplete } = progress;

  const subtitle = [courseInfo.schoolName, courseInfo.groupName].filter(Boolean).join(' · ');

  return (
    <div
      className="overflow-hidden rounded-[18px]"
      style={{
        background: 'var(--ssz-bg-surface)',
        boxShadow: 'var(--ssz-shadow-sm)',
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 5, background: accentColor }} aria-hidden="true" />

      {/* Content */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Flag emoji */}
        <div
          className="flex shrink-0 items-center justify-center rounded-xl text-4xl"
          style={{
            width: 56,
            height: 56,
            background: `oklch(0.95 0.045 ${hue})`,
          }}
          aria-hidden="true"
        >
          {emoji}
        </div>

        {/* Text block */}
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-xl font-semibold leading-tight"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {courseInfo.title}
          </h1>
          {subtitle && (
            <p
              className="mt-0.5 truncate text-[12.5px] leading-tight"
              style={{ color: 'var(--ssz-text-muted)' }}
            >
              {subtitle}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
              style={{
                background: `oklch(0.95 0.045 ${hue})`,
                color: `oklch(0.44 0.09 ${hue})`,
              }}
            >
              {courseInfo.cefrLevel}
            </span>
            <span className="text-xs" style={{ color: 'var(--ssz-text-muted)' }}>
              {t('lessons', { done: completedLessons, total: totalLessons })}
            </span>
          </div>
        </div>

        {/* Ring progress */}
        <RingProgress pct={percentComplete} hue={hue} />
      </div>
    </div>
  );
}
