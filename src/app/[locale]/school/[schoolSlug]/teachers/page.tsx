import { notFound } from "next/navigation";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getTeacherRoster } from "@/features/teachers/api/queries";
import { TeacherRosterClient } from "@/features/teachers/components/roster/teacher-roster-client";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function TeachersPage({ params }: Props) {
  const { schoolSlug } = await params;

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const teachers = await getTeacherRoster(school.id);

  return (
    <TeacherRosterClient
      schoolId={school.id}
      schoolSlug={schoolSlug}
      teachers={teachers}
    />
  );
}
