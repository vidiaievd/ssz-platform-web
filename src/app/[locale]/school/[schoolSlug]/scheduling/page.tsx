import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getCommandCenter } from "@/features/teachers/api/queries";
import { CommandCenterClient } from "@/features/teachers/components/command-center/command-center-client";
import { isSchedulingReady } from "@/lib/scheduling/is-ready";
import type { CommandCenterResponse } from "@/features/teachers/api/queries";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function SchedulingOverviewPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations("Scheduling");

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  if (!isSchedulingReady()) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">{t("notReady.title")}</h1>
        <p className="text-sm text-(--ssz-text-secondary) max-w-sm">{t("notReady.body")}</p>
      </main>
    );
  }

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const result = await getCommandCenter(school.id);
  const isHybrid = school.type === "HYBRID";

  const data: CommandCenterResponse =
    result && !('status' in result)
      ? result
      : {
          kpis: { utilizationAvgPct: 0, spareCapacityHours: 0, overloadedCount: 0, clashCount: 0, vacancyCount: 0 },
          teachers: [],
          violations: [],
          vacancies: [],
          roomLoad: [],
        };

  return (
    <CommandCenterClient
      schoolId={school.id}
      schoolSlug={schoolSlug}
      isHybrid={isHybrid}
      initial={data}
    />
  );
}
