"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { bulkCover } from "../../api/mutations";
import { useSubstitutionUiStore } from "../../stores/substitution-ui-store";

type BulkCoverActionProps = {
  schoolId: string;
  requestIds: string[];
  onComplete?: () => void;
};

export function BulkCoverAction({ schoolId, requestIds, onComplete }: BulkCoverActionProps) {
  const t = useTranslations("Teachers.substitutions");
  const [isPending, startTransition] = useTransition();
  const setBulkProgress = useSubstitutionUiStore((s) => s.setBulkProgress);

  function handleBulkCover() {
    startTransition(async () => {
      const result = await bulkCover(schoolId, requestIds);
      setBulkProgress(result);
      toast.success(t("bulkProgress", { covered: result.covered, flagged: result.flagged }));
      onComplete?.();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending || requestIds.length === 0}
      onClick={handleBulkCover}
    >
      {isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
      {t("bulkCover")}
    </Button>
  );
}
