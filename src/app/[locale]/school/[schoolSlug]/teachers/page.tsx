import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getCommandCenter } from "@/features/teachers/api/queries";
import { getPendingCount } from "@/features/invitations/api/queries";
import { CommandCenterClient } from "@/features/teachers/components/command-center/command-center-client";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function TeachersPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations("Teachers.commandCenter");

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">{t("empty")}</p>
      </main>
    );
  }

  const [data, pendingTeacherInviteCount] = await Promise.all([
    getCommandCenter(school.id),
    getPendingCount(school.id, 'teachers').catch(() => 0),
  ]);
  const isHybrid = school.type === "HYBRID";

  if ("status" in data) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">{t("empty")}</p>
      </main>
    );
  }

  return (
    <CommandCenterClient
      schoolId={school.id}
      schoolSlug={schoolSlug}
      isHybrid={isHybrid}
      initial={data}
      pendingTeacherInviteCount={pendingTeacherInviteCount}
    />
  );
}
