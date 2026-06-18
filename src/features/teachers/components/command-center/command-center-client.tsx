"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removeTeacher } from "../../api/mutations";
import { useCommandCenter } from "../../api/use-command-center";
import { teacherKeys } from "../../api/keys";
import type { CommandCenterResponse } from "../../api/queries";
import { PendingInvitesLink } from "@/features/invitations/components/pending-invites-link";
import { WorkloadKpiRow } from "./workload-kpi-row";
import { TeacherLoadTable } from "./teacher-load-table";
import { PriorityQueue } from "./priority-queue";
import { RoomUtilizationList } from "./room-utilization-list";
import { AddTeacherModal } from "./add-teacher-modal";

type CommandCenterClientProps = {
  schoolId: string;
  schoolSlug: string;
  isHybrid: boolean;
  initial: CommandCenterResponse;
  pendingTeacherInviteCount?: number;
};

export function CommandCenterClient({
  schoolId,
  schoolSlug,
  isHybrid,
  initial,
  pendingTeacherInviteCount = 0,
}: CommandCenterClientProps) {
  const t = useTranslations("Teachers.commandCenter");
  const tRoster = useTranslations("Teachers.roster");
  const queryClient = useQueryClient();
  const { data } = useCommandCenter(schoolId, { initialData: initial });
  const [addOpen, setAddOpen] = useState(false);
  const [, startRemove] = useTransition();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: teacherKeys.commandCenter(schoolId) });
  }

  const violations = data.violations.map((alert) => ({
    id: alert.alertId,
    severity: alert.severity,
    message: alert.message,
    ctaLabel: t("arrangeCover"),
    onCta: () => {},
  }));

  function handleRemoveTeacher(teacherId: string, name: string) {
    const confirmed = window.confirm(
      tRoster("removeGuard.title") + "\n" + name,
    );
    if (!confirmed) return;

    startRemove(async () => {
      const result = await removeTeacher(schoolId, teacherId);
      if (result.ok) {
        toast.success(name, {
          description: tRoster("removeGuard.confirm"),
          action: {
            label: tRoster("removeGuard.undo"),
            onClick: () => {},
          },
        });
        invalidate();
      } else {
        toast.error(tRoster("removeGuard.title"), {
          description: tRoster("removeGuard.body", { count: result.groupCount }),
        });
      }
    });
  }

  const isEmpty = data.teachers.length === 0;

  return (
    <main className="p-4 sm:p-6 space-y-5">
      {data.teachersError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Failed to load teachers</p>
            <p className="mt-0.5 text-destructive/80">{data.teachersError}</p>
          </div>
        </div>
      )}

      {/* Pending invitations indicator */}
      {pendingTeacherInviteCount > 0 && (
        <PendingInvitesLink
          count={pendingTeacherInviteCount}
          href={`/school/${schoolSlug}/invitations?audience=teachers`}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">
          {t("title")}
        </h1>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          aria-label={t("addTeacher")}
        >
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          {t("addTeacher")}
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-(--ssz-text-muted)">{t("empty")}</p>
          <Button onClick={() => setAddOpen(true)} variant="outline">
            {t("emptyCta")}
          </Button>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <WorkloadKpiRow kpis={data.kpis} />

          {/* Main content: table + sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            {/* Teacher load table */}
            <div className="space-y-4">
              <TeacherLoadTable
                teachers={data.teachers}
                onRemove={handleRemoveTeacher}
              />
            </div>

            {/* Sidebar: priority queue + rooms */}
            <div className="space-y-4">
              <PriorityQueue
                violations={violations}
                vacancies={data.vacancies}
              />
              {isHybrid && data.roomLoad.length > 0 && (
                <RoomUtilizationList rooms={data.roomLoad} />
              )}
            </div>
          </div>
        </>
      )}

      <AddTeacherModal
        schoolId={schoolId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          invalidate();
        }}
      />
    </main>
  );
}
