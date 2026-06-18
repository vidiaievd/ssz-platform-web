import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert } from "@/components/ui/alert";
import type { StudentInSchool } from "@/features/students/types";

type Props = {
  clashes: StudentInSchool["clashes"];
};

export async function StudentClashBanner({ clashes }: Props) {
  if (clashes.length === 0) return null;

  const t = await getTranslations("Students");

  return (
    <Alert
      variant="error"
      role="alert"
      aria-live="assertive"
      icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
    >
      <p className="font-semibold mb-1">{t("detail.clash.title")}</p>
      <div className="space-y-1">
        {clashes.map((c, i) => (
          <p key={i} className="text-sm">
            {t("detail.clash.body", {
              groupA: c.groupA,
              dayA: c.day,
              timeA: c.time,
              groupB: c.groupB,
              dayB: c.day,
              timeB: c.time,
            })}
          </p>
        ))}
      </div>
    </Alert>
  );
}
