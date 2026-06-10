import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getTeacherAvailability, getAbsences } from "@/features/teachers/api/queries";
import { TeacherScheduleClient } from "@/features/teachers/components/schedule/teacher-schedule-client";

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

  const [availabilityResult, absencesResult] = await Promise.all([
    getTeacherAvailability(teacherId),
    getAbsences(school.id),
  ]);

  const availability =
    "status" in availabilityResult ? [] : availabilityResult;
  const absences = "status" in absencesResult
    ? []
    : absencesResult.filter((a) => a.teacherId === teacherId);

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
      />
    </main>
  );
}
