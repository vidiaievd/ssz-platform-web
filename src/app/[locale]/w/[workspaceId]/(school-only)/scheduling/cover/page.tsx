import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolByRef } from "@/features/school/api/get-school-by-ref";
import { getCoverQueue } from "@/features/teachers/api/queries";
import { SubstituteConsoleClient } from "@/features/teachers/components/substitutions/substitute-console-client";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export default async function SchedulingCoverPage({ params }: Props) {
  const { workspaceId } = await params;

  const role = await getMySchoolRole(workspaceId);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolByRef(workspaceId);
  if (!school) notFound();

  const queueResult = await getCoverQueue(school.id);
  const requests = "status" in queueResult ? [] : queueResult;

  return (
    <SubstituteConsoleClient
      schoolId={school.id}
      initialRequests={requests}
    />
  );
}
