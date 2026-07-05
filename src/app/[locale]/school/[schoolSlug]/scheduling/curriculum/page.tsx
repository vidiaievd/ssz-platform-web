import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getGroups } from "@/features/groups/api/queries";
import { getCurriculum } from "@/features/teachers/api/queries";
import { CurriculumPlannerClient } from "@/features/teachers/components/curriculum/curriculum-planner-client";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ group?: string }>;
};

export default async function SchedulingCurriculumPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { group: groupId } = await searchParams;

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolBySlug(schoolSlug);
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
