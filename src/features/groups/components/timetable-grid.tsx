import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';
import { slotsOverlap } from '@/lib/groups/operations';
import type { TimetableTeacher, Weekday } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_START_HOUR = 8;
const GRID_END_HOUR   = 21;
const PX_PER_HOUR     = 64; // pixels per hour

const DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** Message keys for the short weekday headers — the labels themselves are per-locale. */
const DAY_LABEL_KEYS = {
  Mon: 'timetable.weekdayShort.mon',
  Tue: 'timetable.weekdayShort.tue',
  Wed: 'timetable.weekdayShort.wed',
  Thu: 'timetable.weekdayShort.thu',
  Fri: 'timetable.weekdayShort.fri',
  Sat: 'timetable.weekdayShort.sat',
  Sun: 'timetable.weekdayShort.sun',
} as const satisfies Record<Weekday, string>;

const LANG_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  nb: { bg: 'bg-blue-100 dark:bg-blue-900/30',   border: 'border-blue-300 dark:border-blue-700',   text: 'text-blue-900 dark:text-blue-200' },
  no: { bg: 'bg-blue-100 dark:bg-blue-900/30',   border: 'border-blue-300 dark:border-blue-700',   text: 'text-blue-900 dark:text-blue-200' },
  en: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200' },
  uk: { bg: 'bg-sky-100 dark:bg-sky-900/30',     border: 'border-sky-300 dark:border-sky-700',     text: 'text-sky-900 dark:text-sky-200' },
  ru: { bg: 'bg-rose-100 dark:bg-rose-900/30',   border: 'border-rose-300 dark:border-rose-700',   text: 'text-rose-900 dark:text-rose-200' },
  de: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200' },
  fr: { bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-900 dark:text-violet-200' },
};

const DEFAULT_STYLE = {
  bg: 'bg-primary-100 dark:bg-primary-900/30',
  border: 'border-primary-300 dark:border-primary-700',
  text: 'text-primary-900 dark:text-primary-200',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function topPx(start: string): number {
  return ((timeToMinutes(start) - GRID_START_HOUR * 60) / 60) * PX_PER_HOUR;
}

function heightPx(start: string, end: string): number {
  return ((timeToMinutes(end) - timeToMinutes(start)) / 60) * PX_PER_HOUR;
}

function langStyle(lang: string) {
  return LANG_STYLES[lang.toLowerCase()] ?? DEFAULT_STYLE;
}

type Lesson = TimetableTeacher['lessons'][number];

function findConflictPairs(lessons: Lesson[]): Set<number> {
  const ids = new Set<number>();
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i]!;
      const b = lessons[j]!;
      if (slotsOverlap(
        { day: a.day, start: a.start, end: a.end, room: '' },
        { day: b.day, start: b.start, end: b.end, room: '' },
      )) {
        ids.add(i);
        ids.add(j);
      }
    }
  }
  return ids;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TimeGutter() {
  const hours: number[] = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) hours.push(h);
  const totalH = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR;

  return (
    <div className="relative shrink-0" style={{ width: 44, height: totalH }} aria-hidden="true">
      {hours.map((h) => (
        <div
          key={h}
          className="absolute text-[11px] text-(--ssz-text-muted) leading-none"
          style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR - 7 }}
        >
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  );
}

type DayColumnProps = {
  day: Weekday;
  lessons: Lesson[];
  conflictIndices: Set<number>;
  allLessons: Lesson[];
  schoolSlug: string;
};

async function DayColumn({ day, lessons, conflictIndices, allLessons, schoolSlug }: DayColumnProps) {
  const t = await getTranslations('Groups');
  const totalH = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR;
  const dayLessons = lessons.filter((l) => l.day === day);

  // Group by overlap clusters for side-by-side rendering
  const indexedDayLessons = dayLessons.map((l) => ({
    lesson: l,
    globalIndex: allLessons.indexOf(l),
  }));

  return (
    <div className="relative flex-1 border-l border-border" style={{ height: totalH }}>
      {/* Hour grid lines */}
      {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-border/40"
          style={{ top: i * PX_PER_HOUR }}
        />
      ))}
      {/* Half-hour lines */}
      {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
        <div
          key={`h${i}`}
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-border/20 border-dashed"
          style={{ top: i * PX_PER_HOUR + PX_PER_HOUR / 2 }}
        />
      ))}

      {/* Lesson blocks */}
      {indexedDayLessons.map(({ lesson, globalIndex }, colIdx) => {
        const isConflict   = conflictIndices.has(globalIndex);
        const isSub        = lesson.isSubstitute;
        const style        = langStyle(lesson.lang);
        const top          = topPx(lesson.start);
        const height       = heightPx(lesson.start, lesson.end);

        // Count how many conflicting lessons share this exact slot
        const siblingsAtSlot = indexedDayLessons.filter(
          (x) => x.lesson !== lesson && conflictIndices.has(x.globalIndex) && isConflict
            && slotsOverlap(
              { day: lesson.day, start: lesson.start, end: lesson.end, room: '' },
              { day: x.lesson.day, start: x.lesson.start, end: x.lesson.end, room: '' },
            ),
        );
        const siblingCount = siblingsAtSlot.length;
        const siblingIdx   = siblingCount > 0
          ? indexedDayLessons
              .filter((x) => conflictIndices.has(x.globalIndex) && isConflict
                && slotsOverlap(
                  { day: lesson.day, start: lesson.start, end: lesson.end, room: '' },
                  { day: x.lesson.day, start: x.lesson.start, end: x.lesson.end, room: '' },
                ))
              .indexOf(indexedDayLessons[colIdx]!)
          : 0;

        const totalSlotCount = siblingCount + 1;
        const widthPct = isConflict && siblingCount > 0 ? `${100 / totalSlotCount}%` : 'calc(100% - 4px)';
        const leftPct  = isConflict && siblingCount > 0 ? `${(100 / totalSlotCount) * siblingIdx}%` : '2px';

        const time = `${lesson.start}–${lesson.end}`;
        const ariaLabel = isConflict
          ? t('timetable.conflictBlockAria', { group: lesson.groupName, time })
          : t('timetable.blockAria', { group: lesson.groupName, time });

        return (
          <Link
            key={globalIndex}
            href={`/school/${schoolSlug}/groups/${lesson.groupId}`}
            aria-label={ariaLabel}
            className={cn(
              'absolute rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight overflow-hidden',
              'border transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSub
                ? 'border-dashed opacity-75 bg-muted/50 text-(--ssz-text-secondary) border-border'
                : isConflict
                  ? 'bg-error-100 dark:bg-error-900/40 border-error-400 dark:border-error-600 text-error-900 dark:text-error-200'
                  : cn(style.bg, style.border, style.text),
            )}
            style={{ top, height: Math.max(height, 20), left: leftPct, width: widthPct }}
          >
            <div className="flex items-start gap-0.5">
              {isConflict && <Clock className="size-3 shrink-0 mt-0.5 text-error-600" aria-hidden="true" />}
              <span className="truncate">{lesson.groupName}</span>
            </div>
            {height >= 40 && (
              <span className="text-[10px] opacity-70 block truncate">
                {lesson.lang.toUpperCase()} {lesson.start}–{lesson.end}
                {isSub && ` (${t('timetable.subSuffix')})`}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ── Main grid ─────────────────────────────────────────────────────────────────

type Props = {
  teacher: TimetableTeacher;
  schoolSlug: string;
};

export async function TimetableGrid({ teacher, schoolSlug }: Props) {
  const t = await getTranslations('Groups');
  const { lessons } = teacher;
  const conflictIndices = findConflictPairs(lessons);

  return (
    <div className="overflow-x-auto" role="region" aria-label={t('timetable.gridAria')}>
      {/* Minimum width so the grid is usable on mobile (horizontal scroll) */}
      <div style={{ minWidth: 480 }}>
      {/* Day headers */}
      <div className="flex" style={{ paddingLeft: 44 }}>
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) py-2 border-l border-border first:border-l-0"
          >
            {t(DAY_LABEL_KEYS[day])}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex">
        <TimeGutter />
        {DAYS.map((day) => (
          <DayColumn
            key={day}
            day={day}
            lessons={lessons}
            conflictIndices={conflictIndices}
            allLessons={lessons}
            schoolSlug={schoolSlug}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
