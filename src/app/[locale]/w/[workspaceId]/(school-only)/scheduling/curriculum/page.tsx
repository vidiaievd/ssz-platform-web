import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolByRef } from "@/features/school/api/get-school-by-ref";
import { getGroups } from "@/features/groups/api/queries";
import { getCurriculum } from "@/features/teachers/api/queries";
import { CurriculumPlannerClient } from "@/features/teachers/components/curriculum/curriculum-planner-client";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
  searchParams: Promise<{ group?: string }>;
};

export default async function SchedulingCurriculumPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const { group: groupId } = await searchParams;

  const role = await getMySchoolRole(workspaceId);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolByRef(workspaceId);
  if (!school) notFound();

  const { groups } = await getGroups(school.id);
  const firstGroupId = groupId ?? groups[0]?.id;

  const planResult = firstGroupId ? await getCurriculum(firstGroupId) : null;
  const plan = planResult && !("status" in planResult) ? planResult : null;

  return (
    <CurriculumPlannerClient
      schoolId={school.id}
      groups={groups}
      selectedGroupId={firstGroupId ?? null}
      plan={plan}
    />
  );
}
