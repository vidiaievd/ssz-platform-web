import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolByRef } from "@/features/school/api/get-school-by-ref";
import { getTeacherRoster } from "@/features/teachers/api/queries";
import { TeacherRosterClient } from "@/features/teachers/components/roster/teacher-roster-client";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export default async function TeachersPage({ params }: Props) {
  const { workspaceId } = await params;

  const role = await getMySchoolRole(workspaceId);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolByRef(workspaceId);
  if (!school) notFound();

  const teachers = await getTeacherRoster(school.id);

  return (
    <TeacherRosterClient
      schoolId={school.id}
      workspaceId={workspaceId}
      teachers={teachers}
    />
  );
}
