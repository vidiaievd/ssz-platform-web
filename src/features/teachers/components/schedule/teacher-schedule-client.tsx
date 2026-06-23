"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import type { AvailabilityBlock, Absence } from "../../types";
import { WeeklyGrid, type Lesson } from "./weekly-grid";
import { AvailabilityEditor } from "./availability-editor";
import { AbsenceReportForm } from "./absence-report-form";

type TeacherScheduleClientProps = {
  schoolId: string;
  teacherId: string;
  availabilityBlocks: AvailabilityBlock[];
  absences: Absence[];
  lessons: Lesson[];
};

type PanelId = "grid" | "availability" | "absence";

export function TeacherScheduleClient({
  schoolId,
  teacherId,
  availabilityBlocks,
  absences,
  lessons,
}: TeacherScheduleClientProps) {
  const t = useTranslations("Teachers.schedule");
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<PanelId>("grid");

  const openAbsences = absences.filter((a) => a.coveredCount < a.affectedLessonCount);

  return (
    <div className="space-y-5">
      {/* Open absences summary */}
      {openAbsences.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-950/30 px-4 py-2.5"
        >
          <p className="text-sm text-warning-800 dark:text-warning-200">
            {t("absenceList")}: {openAbsences.length}
          </p>
        </div>
      )}

      {/* Sub-panel tabs */}
      <div
        className="flex gap-1 border-b border-border"
        role="tablist"
        aria-label={t("title")}
      >
        {(["grid", "availability", "absence"] as PanelId[]).map((panel) => {
          const isActive = activePanel === panel;
          return (
            <button
              key={panel}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePanel(panel)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) hover:border-border",
              ].join(" ")}
            >
              {panel === "grid" && t("title")}
              {panel === "availability" && t("availabilityEditor")}
              {panel === "absence" && t("reportAbsence")}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      {activePanel === "grid" && (
        <WeeklyGrid
          availabilityBlocks={availabilityBlocks}
          lessons={lessons}
        />
      )}

      {activePanel === "availability" && (
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold text-(--ssz-text-primary) mb-3">
            {t("availabilityEditor")}
          </h2>
          <AvailabilityEditor
            schoolId={schoolId}
            teacherId={teacherId}
            initialBlocks={availabilityBlocks}
            onSaved={() => {
              router.refresh();
            }}
          />
        </div>
      )}

      {activePanel === "absence" && (
        <div className="max-w-lg">
          <h2 className="text-sm font-semibold text-(--ssz-text-primary) mb-3">
            {t("reportAbsence")}
          </h2>
          <AbsenceReportForm
            schoolId={schoolId}
            teacherId={teacherId}
            onSuccess={() => {
              router.refresh();
              setActivePanel("grid");
            }}
          />
        </div>
      )}
    </div>
  );
}
