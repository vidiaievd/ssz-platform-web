import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMySchoolRole } from "@/features/school/api/get-my-school-role";

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SCHEDULER'] as const;

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function SchedulingCoverPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations("Scheduling");

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold text-(--ssz-text-primary)">{t("cover.title")}</h1>
      <p className="text-sm text-(--ssz-text-secondary)">{t("stub.body")}</p>
    </main>
  );
}
