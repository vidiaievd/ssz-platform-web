"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { assignSubstitute } from "../../api/mutations";
import { useSubstitutionUiStore } from "../../stores/substitution-ui-store";
import type { SubstituteCandidate } from "../../types";

type CandidateListProps = {
  schoolId: string;
  requestId: string;
  candidates: SubstituteCandidate[];
  onAssigned?: () => void;
};

function ClassificationPill({ c }: { c: SubstituteCandidate["classification"] }) {
  const t = useTranslations("Teachers.substitutions.candidateList");
  const cls =
    c === "best"
      ? "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400"
      : c === "good"
        ? "bg-primary/10 text-primary"
        : c === "ok"
          ? "bg-muted text-(--ssz-text-secondary)"
          : "bg-muted text-(--ssz-text-muted) opacity-60";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>
      {c === "best" && t("classificationBest")}
      {c === "good" && t("classificationGood")}
      {c === "ok" && t("classificationOk")}
      {c === "ineligible" && t("classificationIneligible")}
    </span>
  );
}

function FactorChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
        ok
          ? "bg-success-50 text-success-700 dark:bg-success-950/30 dark:text-success-400"
          : "bg-error-50 text-error-700 dark:bg-error-950/30 dark:text-error-400",
      )}
    >
      {ok ? <Check className="size-2.5" aria-hidden="true" /> : <XCircle className="size-2.5" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function CandidateList({ schoolId, requestId, candidates, onAssigned }: CandidateListProps) {
  const t = useTranslations("Teachers.substitutions.candidateList");
  const [isPending, startTransition] = useTransition();
  const setLastValidation = useSubstitutionUiStore((s) => s.setLastValidation);

  function handleAssign(candidate: SubstituteCandidate, override = false) {
    startTransition(async () => {
      const result = await assignSubstitute(schoolId, requestId, candidate.teacherId, override);
      if (result.ok) {
        setLastValidation({ requestId, passed: true, message: null });
        toast.success(candidate.name, {
          description: t("assign"),
          action: {
            label: t("undo"),
            onClick: () => {},
          },
        });
        onAssigned?.();
      } else {
        const message = t("assign");
        setLastValidation({ requestId, passed: false, message });
        toast.error(t("assign"), { description: message });
      }
    });
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-(--ssz-text-muted) py-4 text-center">{t("noEligible")}</p>
    );
  }

  const eligible = candidates.filter((c) => c.eligible);
  const ineligible = candidates.filter((c) => !c.eligible);

  return (
    <ul className="space-y-2" aria-label={t("title")}>
      {[...eligible, ...ineligible].map((candidate, idx) => (
        <li
          key={candidate.teacherId}
          className={cn(
            "rounded-xl border px-3 py-2.5 flex flex-col gap-2",
            candidate.classification === "best"
              ? "border-success-200 bg-success-50/50 dark:border-success-800 dark:bg-success-950/20"
              : "border-border bg-card",
            !candidate.eligible && "opacity-60",
          )}
        >
          {/* Header row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-(--ssz-text-primary)">
                  {candidate.name}
                </span>
                <ClassificationPill c={candidate.classification} />
              </div>
              <p className="text-xs text-(--ssz-text-muted) mt-0.5">
                score: {candidate.fitScore}
              </p>
            </div>
            {candidate.eligible && (
              <Button
                size="sm"
                variant={candidate.classification === "best" ? "primary" : "outline"}
                disabled={isPending}
                onClick={() => handleAssign(candidate)}
              >
                {isPending && idx === 0 ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  t("assign")
                )}
              </Button>
            )}
          </div>

          {/* Factor chips */}
          <div className="flex flex-wrap gap-1">
            <FactorChip label="lang" ok={candidate.factors.canLang} />
            <FactorChip label="free" ok={candidate.factors.free} />
            <FactorChip label="spare" ok={candidate.factors.spareRatio >= 0.15} />
            <FactorChip label="familiar" ok={candidate.factors.familiar} />
            {candidate.factors.wouldOverload && (
              <FactorChip label="overload" ok={false} />
            )}
            {candidate.factors.subLoop && (
              <FactorChip label="sub-loop" ok={false} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
