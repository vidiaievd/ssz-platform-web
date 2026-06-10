"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AbsenceReportForm } from "../schedule/absence-report-form";
import { CoverQueueRail } from "./cover-queue-rail";
import { CandidateList } from "./candidate-list";
import { ValidationNote } from "./validation-note";
import { BulkCoverAction } from "./bulk-cover-action";
import type { SubstituteRequest, SubstituteCandidate } from "../../types";

type SubstituteConsoleClientProps = {
  schoolId: string;
  initialRequests: SubstituteRequest[];
};

export function SubstituteConsoleClient({
  schoolId,
  initialRequests,
}: SubstituteConsoleClientProps) {
  const t = useTranslations("Teachers.substitutions");
  const tSched = useTranslations("Teachers.schedule");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRequests[0]?.requestId ?? null,
  );
  const [candidates, setCandidates] = useState<SubstituteCandidate[]>([]);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  const selectedRequest = initialRequests.find((r) => r.requestId === selectedId) ?? null;

  async function loadCandidates(requestId: string) {
    setIsLoadingCandidates(true);
    try {
      const res = await fetch(
        `/api/schools/${schoolId}/scheduling/substitutions/${requestId}/candidates`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as SubstituteCandidate[];
        setCandidates(data);
      }
    } finally {
      setIsLoadingCandidates(false);
    }
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    void loadCandidates(id);
  }

  return (
    <main className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <BulkCoverAction
            schoolId={schoolId}
            requestIds={initialRequests.map((r) => r.requestId)}
            onComplete={() => router.refresh()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAbsenceForm((v) => !v)}
          >
            {t("reportAbsence")}
          </Button>
        </div>
      </div>

      {/* Absence form overlay */}
      {showAbsenceForm && (
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <AbsenceReportForm
            schoolId={schoolId}
            teacherId=""
            onSuccess={() => {
              setShowAbsenceForm(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {/* Master-detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Rail (master) */}
        <aside
          className="w-64 shrink-0 border-r border-border overflow-y-auto"
          aria-label={t("title")}
        >
          <CoverQueueRail
            requests={initialRequests}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </aside>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!selectedRequest ? (
            <p className="text-sm text-(--ssz-text-muted)">{t("empty")}</p>
          ) : (
            <>
              {/* Absence header */}
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-(--ssz-text-primary)">
                  {selectedRequest.groupName}
                </h2>
                <p className="text-sm text-(--ssz-text-secondary)">
                  {selectedRequest.day} · {selectedRequest.start}–{selectedRequest.end}
                  {" · "}{selectedRequest.lang.toUpperCase()}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span
                    className={[
                      "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase",
                      selectedRequest.urgency === "today"
                        ? "bg-error-100 text-error-700"
                        : selectedRequest.urgency === "upcoming"
                          ? "bg-warning-100 text-warning-700"
                          : "bg-muted text-(--ssz-text-muted)",
                    ].join(" ")}
                  >
                    {selectedRequest.urgency === "today" && t("urgencyToday")}
                    {selectedRequest.urgency === "upcoming" && t("urgencyUpcoming")}
                    {selectedRequest.urgency === "open" && t("urgencyOpen")}
                  </span>
                </div>
              </div>

              {/* Candidates */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-(--ssz-text-secondary)">
                  {t("candidateList.title")}
                </h3>
                {isLoadingCandidates ? (
                  <p className="text-sm text-(--ssz-text-muted)">{tSched("title")}…</p>
                ) : (
                  <CandidateList
                    schoolId={schoolId}
                    requestId={selectedRequest.requestId}
                    candidates={candidates}
                    onAssigned={() => router.refresh()}
                  />
                )}
                <ValidationNote requestId={selectedRequest.requestId} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
