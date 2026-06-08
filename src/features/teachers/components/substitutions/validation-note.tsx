"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubstitutionUiStore } from "../../stores/substitution-ui-store";

type ValidationNoteProps = {
  requestId: string;
};

export function ValidationNote({ requestId }: ValidationNoteProps) {
  const t = useTranslations("Teachers.substitutions.candidateList");
  const validation = useSubstitutionUiStore((s) =>
    s.lastValidation?.requestId === requestId ? s.lastValidation : null,
  );

  if (!validation) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        validation.passed
          ? "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950/30 dark:text-success-400"
          : "border-error-200 bg-error-50 text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-400",
      )}
    >
      {validation.passed ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{validation.message ?? t("assign")}</span>
    </div>
  );
}
