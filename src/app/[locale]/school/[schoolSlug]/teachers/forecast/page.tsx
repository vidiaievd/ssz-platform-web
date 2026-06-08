import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getCommandCenter } from "@/features/teachers/api/queries";
import { ForecastDashboardClient } from "@/features/teachers/components/forecast/forecast-dashboard-client";
import type { ForecastBaseline } from "@/features/teachers/types";

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

export default async function ForecastPage({ params }: Props) {
  const { schoolSlug } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">School not found.</p>
      </main>
    );
  }

  const data = await getCommandCenter(school.id);
  const teachers = "status" in data ? [] : data.teachers;

  const baseline: ForecastBaseline = {
    studentCount: teachers.reduce((s, t) => s + t.groupCount * 8, 0),
    activeTeacherCount: teachers.length,
    perLanguage: Object.entries(
      teachers.reduce<Record<string, { teachers: number; groups: number }>>((acc, t) => {
        for (const lang of t.languages) {
          const entry = acc[lang] ?? { teachers: 0, groups: 0 };
          entry.teachers += 1;
          entry.groups += t.groupCount;
          acc[lang] = entry;
        }
        return acc;
      }, {}),
    ).map(([lang, v]) => ({
      lang: lang as ForecastBaseline["perLanguage"][number]["lang"],
      teacherCount: v.teachers,
      groupCount: v.groups,
      studentCount: v.groups * 8,
    })),
  };

  return (
    <ForecastDashboardClient
      schoolId={school.id}
      baseline={baseline}
    />
  );
}
