import { getTranslations } from "next-intl/server";

import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getGroups } from "@/features/groups/api/queries";
import { getCurriculum } from "@/features/teachers/api/queries";
import { CurriculumPlannerClient } from "@/features/teachers/components/curriculum/curriculum-planner-client";

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ group?: string }>;
};

export default async function CurriculumPlannerPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { group: groupId } = await searchParams;
  const t = await getTranslations("Teachers.curriculum");

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">{t("title")}</p>
      </main>
    );
  }

  const groups = await getGroups(school.id);
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
