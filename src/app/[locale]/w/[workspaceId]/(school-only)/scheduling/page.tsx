import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolByRef } from "@/features/school/api/get-school-by-ref";
import { getCommandCenter } from "@/features/teachers/api/queries";
import { CommandCenterClient } from "@/features/teachers/components/command-center/command-center-client";
import type { CommandCenterResponse } from "@/features/teachers/api/queries";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export default async function SchedulingOverviewPage({ params }: Props) {
  const { workspaceId } = await params;

  const role = await getMySchoolRole(workspaceId);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolByRef(workspaceId);
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
      workspaceId={workspaceId}
      isHybrid={isHybrid}
      initial={data}
    />
  );
}
