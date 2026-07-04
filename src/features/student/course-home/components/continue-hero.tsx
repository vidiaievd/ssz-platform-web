import { useTranslations } from 'next-intl';

import type { CourseProgress } from '@/features/learning';

export type ContinueScenario = 'overdue' | 'review' | 'resume' | 'start' | 'caught-up';

/* ── Scenario derivation (pure, testable) ───────────────────────── */

export function deriveContinueScenario(opts: {
  overdueAssignmentCount: number;
  srsDueCount: number;
  modules: CourseProgress['modules'];
}): ContinueScenario {
  const { overdueAssignmentCount, srsDueCount, modules } = opts;
  if (overdueAssignmentCount > 0) return 'overdue';
  if (srsDueCount >= 20) return 'review';
  if (modules.some((m) => m.status === 'in_progress')) return 'resume';
  if (modules.every((m) => m.status === 'completed')) return 'caught-up';
  return 'start';
}

/* ── Hero visual config per scenario ────────────────────────────── */

const SCENARIO_BG: Record<ContinueScenario, string> = {
  overdue:   'oklch(0.60 0.125 15)',
  review:    'oklch(0.62 0.105 235)',
  resume:    'oklch(0.62 0.105 168)',
  start:     'oklch(0.62 0.105 168)',
  'caught-up': 'oklch(0.55 0.10 145)',
};

/* ── Props ───────────────────────────────────────────────────────── */

export interface ContinueHeroProps {
  scenario: ContinueScenario;
  /** href the CTA button navigates to */
  ctaHref: string;
  /** e.g. srsDueCount for the review scenario */
  srsDueCount?: number;
}

export function ContinueHero({ scenario, ctaHref, srsDueCount = 0 }: ContinueHeroProps) {
  const t = useTranslations('Learning.courseHome.hero');

  const bg = SCENARIO_BG[scenario];

  type Keys = 'overdueLabel' | 'overdueTitle' | 'overdueMeta' | 'overdueCta'
    | 'reviewLabel' | 'reviewTitle' | 'reviewMeta' | 'reviewCta'
    | 'resumeLabel' | 'resumeTitle' | 'resumeMeta' | 'resumeCta'
    | 'startLabel' | 'startTitle' | 'startMeta' | 'startCta'
    | 'caughtLabel' | 'caughtTitle' | 'caughtMeta' | 'caughtCta';

  const prefix = scenario === 'caught-up' ? 'caught' : scenario;

  const label = t(`${prefix}Label` as Keys);
  const title = scenario === 'review'
    ? t('reviewTitle', { count: srsDueCount })
    : t(`${prefix}Title` as Keys);
  const meta  = t(`${prefix}Meta` as Keys);
  const cta   = t(`${prefix}Cta` as Keys);

  return (
    <a
      href={ctaHref}
      className="relative block overflow-hidden rounded-2xl"
      style={{ background: bg, minHeight: 184, textDecoration: 'none' }}
      aria-label={`${title} — ${cta}`}
    >
      {/* Decorative circles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          right: -30,
          top: -30,
          background: 'rgba(255,255,255,0.08)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 120,
          height: 120,
          right: 30,
          bottom: -40,
          background: 'rgba(255,255,255,0.06)',
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col justify-between gap-4 p-6" style={{ minHeight: 184 }}>
        <div>
          {/* Overline */}
          <span
            className="mb-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.95)' }}
          >
            {label}
          </span>

          {/* Title */}
          <p
            className="text-[25px] font-bold leading-tight text-white"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
          >
            {title}
          </p>

          {/* Meta */}
          <p className="mt-1 text-[13.5px] text-white/90">{meta}</p>
        </div>

        {/* CTA button */}
        <span
          className="inline-flex w-fit items-center rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-px"
          style={{
            background: 'rgba(255,255,255,1)',
            color: bg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          {cta}
        </span>
      </div>
    </a>
  );
}
