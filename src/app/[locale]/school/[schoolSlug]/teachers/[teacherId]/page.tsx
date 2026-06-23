import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getTeacherAvailability, getAbsences } from "@/features/teachers/api/queries";
import { getTeacherSchedule } from "@/features/groups/api/queries";
import { timeToMinutes } from "@/lib/groups/operations";
import { TeacherScheduleClient } from "@/features/teachers/components/schedule/teacher-schedule-client";
import type { Lesson } from "@/features/teachers/components/schedule/weekly-grid";

type Props = {
  params: Promise<{ schoolSlug: string; locale: string; teacherId: string }>;
};

export default async function TeacherSchedulePage({ params }: Props) {
  const { schoolSlug, locale, teacherId } = await params;
  const t = await getTranslations("Teachers.schedule");

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">{t("title")}</p>
      </main>
    );
  }

  const [availabilityResult, absencesResult, scheduleResult] = await Promise.all([
    getTeacherAvailability(teacherId),
    getAbsences(school.id),
    getTeacherSchedule(school.id, teacherId),
  ]);

  const availability =
    "status" in availabilityResult ? [] : availabilityResult;
  const absences = "status" in absencesResult
    ? []
    : absencesResult.filter((a) => a.teacherId === teacherId);

  const scheduleLessons =
    "data" in scheduleResult ? scheduleResult.data?.lessons ?? [] : [];

  const conflictIndices = new Set<number>();
  for (let i = 0; i < scheduleLessons.length; i++) {
    const a = scheduleLessons[i]!;
    for (let j = i + 1; j < scheduleLessons.length; j++) {
      const b = scheduleLessons[j]!;
      if (
        a.day === b.day &&
        timeToMinutes(a.start) < timeToMinutes(b.end) &&
        timeToMinutes(b.start) < timeToMinutes(a.end)
      ) {
        conflictIndices.add(i);
        conflictIndices.add(j);
      }
    }
  }

  const lessons: Lesson[] = scheduleLessons.map((l, i) => {
    const startHour = timeToMinutes(l.start) / 60;
    const durationHours = (timeToMinutes(l.end) - timeToMinutes(l.start)) / 60;
    return {
      lessonId: `${l.groupId}-${l.day}-${l.start}`,
      groupName: l.groupName,
      day: l.day,
      startHour,
      durationHours,
      lang: l.lang,
      hasConflict: conflictIndices.has(i),
    };
  });

  return (
    <main className="p-4 sm:p-6 space-y-5">
      {/* Back link */}
      <Link
        href={`/${locale}/school/${schoolSlug}/teachers`}
        className="inline-flex items-center gap-1.5 text-sm text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("teacherSwitcher")}
      </Link>

      <TeacherScheduleClient
        schoolId={school.id}
        teacherId={teacherId}
        availabilityBlocks={availability}
        absences={absences}
        lessons={lessons}
      />
    </main>
  );
}
