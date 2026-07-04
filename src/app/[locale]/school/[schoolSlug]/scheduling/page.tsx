import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getCommandCenter } from "@/features/teachers/api/queries";
import { CommandCenterClient } from "@/features/teachers/components/command-center/command-center-client";
import type { CommandCenterResponse } from "@/features/teachers/api/queries";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function SchedulingOverviewPage({ params }: Props) {
  const { schoolSlug } = await params;

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
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
          teachersError: 'Failed to load command center data',
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
