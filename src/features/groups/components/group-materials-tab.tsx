import Link from 'next/link';
import { AlertCircle, BookOpen, ChevronRight, Clock, ExternalLink } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';
import { CourseChangeButton } from './course-change-button';
import type { Group } from '../types';
import type { GroupMaterialsView } from '../api/queries';

/** Ring showing how much of the teaching plan the group has been given. */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <svg width={size} height={size} role="img" aria-label={`${label}: ${Math.round(filled)}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * filled) / 100} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="stroke-primary-500 transition-[stroke-dasharray]"
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-(--ssz-text-primary) text-[11px] font-semibold"
        >
          {Math.round(filled)}%
        </text>
      </svg>
      <span className="text-[10px] text-(--ssz-text-muted) text-center max-w-[80px] leading-tight">
        {label}
      </span>
    </div>
  );
}

type Props = {
  group: Group;
  materials: GroupMaterialsView;
  /** Share of the teaching plan already delivered — group progress, never a student's. */
  progressPct: number;
  schoolId: string;
  schoolSlug: string;
  canManage: boolean;
};

export async function GroupMaterialsTab({
  group,
  materials,
  progressPct,
  schoolId,
  schoolSlug,
  canManage,
}: Props) {
  const t = await getTranslations('Groups');
  const { course, units, lessonCount, structureUnavailable } = materials;

  if (!course) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <BookOpen className="size-5 text-(--ssz-text-muted)" aria-hidden="true" />
        </div>
        <p className="text-sm text-(--ssz-text-muted)">{t('materials.noCourse')}</p>
        {canManage && <CourseChangeButton group={group} schoolId={schoolId} label={t('materials.attachCourse')} />}
      </div>
    );
  }

  const extraMaterials = group.materials.filter((m) => m.courseId !== course.id);

  return (
    <div className="space-y-6">
      {/* Course card */}
      <section
        aria-labelledby="materials-course-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3
              id="materials-course-heading"
              className="text-sm font-semibold text-(--ssz-text-primary) truncate"
            >
              {course.title}
            </h3>
            <p className="mt-1 text-xs text-(--ssz-text-muted)">
              {t('materials.counts', { units: units.length, lessons: lessonCount })}
            </p>
            <p className="mt-1 text-xs text-(--ssz-text-muted)">
              {course.versionId
                ? t('materials.published')
                : t('materials.notPublished')}
            </p>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Link
                href={`/school/${schoolSlug}/content/${course.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {t('materials.openCourse')}
              </Link>
              {canManage && (
                <CourseChangeButton group={group} schoolId={schoolId} label={t('materials.change')} />
              )}
            </div>
          </div>

          <ProgressRing pct={progressPct} label={t('materials.planProgress')} />
        </div>
      </section>

      {/* Curriculum */}
      <section aria-labelledby="materials-units-heading">
        <h3
          id="materials-units-heading"
          className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-3"
        >
          {t('materials.curriculumHeading')}
        </h3>

        {structureUnavailable ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/10 px-4 py-3">
            <AlertCircle className="size-4 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-warning-700 dark:text-warning-300">
              {t('materials.structureUnavailable')}
            </p>
          </div>
        ) : units.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">
            {course.versionId ? t('materials.emptyCourse') : t('materials.notPublishedBody')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {units.map((unit) => (
              <details key={unit.id} className="group rounded-lg border border-border bg-card">
                <summary
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 cursor-pointer list-none',
                    'hover:bg-muted/40 rounded-lg transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  )}
                >
                  <ChevronRight
                    className="size-4 text-(--ssz-text-muted) shrink-0 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 text-sm font-medium text-(--ssz-text-primary) truncate">
                    {unit.title}
                  </span>
                  <span className="text-xs text-(--ssz-text-muted) whitespace-nowrap">
                    {t('materials.lessonCount', { count: unit.lessons.length })}
                  </span>
                </summary>

                {unit.lessons.length > 0 && (
                  <ul className="border-t border-border px-4 py-2 flex flex-col gap-1.5">
                    {unit.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-2 text-sm">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--ssz-text-muted) shrink-0">
                          {lesson.kind}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-(--ssz-text-secondary)">
                          {lesson.title}
                        </span>
                        {lesson.durationMinutes !== null && (
                          <span className="inline-flex items-center gap-1 text-xs text-(--ssz-text-muted) shrink-0">
                            <Clock className="size-3" aria-hidden="true" />
                            {t('materials.minutes', { count: lesson.durationMinutes })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Additional materials attached to the group itself */}
      <section aria-labelledby="materials-extra-heading">
        <h3
          id="materials-extra-heading"
          className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-3"
        >
          {t('edit.materialsHeading')}
        </h3>

        {extraMaterials.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">{t('edit.noMaterials')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {extraMaterials.map((material) => (
              <li
                key={material.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5"
              >
                <BookOpen className="size-3.5 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
                <Link
                  href={`/school/${schoolSlug}/content/${material.courseId}`}
                  className="flex-1 min-w-0 truncate text-sm text-(--ssz-text-secondary) hover:underline"
                >
                  {material.courseName ?? material.courseId}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
