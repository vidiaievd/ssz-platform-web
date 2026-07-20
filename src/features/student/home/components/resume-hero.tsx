'use client';

import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { langHue } from '@/features/student/lib/lang-hue';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

export interface ResumeHeroData {
  langCode: string;
  langName: string;
  level?: string;
  courseTitle: string;
  /** The lesson/item the student lands on when resuming. */
  nextItemTitle: string;
  progressPercent: number;
  href: string;
  /** Drives the overline and CTA wording — you cannot "resume" what you never opened. */
  started?: boolean;
}

export interface ResumeHeroProps {
  course: ResumeHeroData;
  className?: string;
}

/** The screen's primary action: a full-bleed, language-tinted "pick up where you left off" panel. */
export function ResumeHero({ course, className }: ResumeHeroProps) {
  const t = useTranslations('Student.home.resume');
  const hue = langHue(course.langCode);
  const meta = [course.langName, course.level].filter(Boolean).join(' · ');
  const started = course.started !== false;

  return (
    <section
      style={{ background: `linear-gradient(135deg, ${hue.c}, ${hue.deep})`, '--hue-deep': hue.deep } as React.CSSProperties}
      className={cn(
        'relative overflow-hidden rounded-xl p-6 text-white shadow-(--ssz-shadow-lg) sm:p-7',
        className,
      )}
    >
      {/* Decorative depth — purely ornamental, never announced. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-45 rounded-full bg-white/8"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-15 -bottom-12 size-30 rounded-full bg-white/6"
      />

      <div className="relative">
        <p className="mb-2 text-[11px] font-bold tracking-[0.08em] uppercase opacity-80">
          {started ? t('overline') : t('overlineNew')}
        </p>
        {meta && <p className="mb-0.75 text-[13px] opacity-85">{meta}</p>}
        <h2 className="mb-4.5 text-[23px] leading-tight font-bold tracking-[-0.02em]">
          {course.nextItemTitle}
        </h2>

        <div className="mb-5 max-w-105">
          <div className="mb-1.5 flex justify-between gap-3 text-xs opacity-80">
            <span className="truncate">{course.courseTitle}</span>
            <span>{course.progressPercent}%</span>
          </div>
          {/* Presentational only — the same figure is announced by the text above. */}
          <div aria-hidden="true" className="h-1.5 rounded-full bg-white/22">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-slow ease-out-ssz"
              style={{ width: `${course.progressPercent}%` }}
            />
          </div>
        </div>

        <Link
          href={course.href}
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-white px-5.5 py-2.75 text-sm font-bold text-(--hue-deep)',
            'transition-[box-shadow,transform] duration-base ease-out-ssz',
            'hover:-translate-y-px hover:shadow-(--ssz-shadow-md)',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
          )}
        >
          <Play size={13} aria-hidden="true" />
          {started ? t('cta') : t('ctaStart')}
        </Link>
      </div>
    </section>
  );
}
