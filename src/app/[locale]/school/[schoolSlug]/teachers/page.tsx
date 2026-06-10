import { getTranslations } from "next-intl/server";

import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getCommandCenter } from "@/features/teachers/api/queries";
import { CommandCenterClient } from "@/features/teachers/components/command-center/command-center-client";

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function TeachersPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations("Teachers.commandCenter");

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <main className="p-6">
        <p className="text-sm text-(--ssz-text-muted)">{t("empty")}</p>
      </main>
    );
  }

  const data = await getCommandCenter(school.id);
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
    />
  );
}
