import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GroupDetailHeader } from "./group-detail-header";
import { GroupResolveBanner } from "./group-resolve-banner";
import { GroupTabs } from "./group-tabs";
import { GroupMaterialsTab } from "./group-materials-tab";
import type { Group, RosterStudent, CourseView, OutlineUnit, Session } from "../types";
import type { CurriculumUnit } from "@/features/teachers/types";
import type { GroupMaterialsView } from "../api/queries";
import type { Alert } from "@/features/dashboard/types";

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  group: Group;
  roster: RosterStudent[];
  alerts: Alert[];
  /** Every session of the group — the schedule & log tab reads a whole course. */
  sessions: Session[];
  /** Units of the published course, for naming what a session teaches. */
  outlineUnits: OutlineUnit[];
  /** The school's pass mark, for reading exam results. */
  passMark: number;
  /** Every teacher of the school — cover is often somebody outside the group. */
  schoolTeachers: Array<{ userId: string; name: string }>;
  /** The signed-in user — a teacher only edits the sessions they teach. */
  viewerId: string | null;
  /** Units of the group's teaching plan; empty when no plan exists yet. */
  planUnits: CurriculumUnit[];
  materials: GroupMaterialsView;
  /** Share of the teaching plan delivered — the group's progress, not a student's. */
  planProgressPct: number;
  courseView: CourseView;
  /** Real school id (UUID) — mutations take this; schoolSlug is for hrefs only. */
  schoolId: string;
  schoolSlug: string;
  canManage: boolean;
};

export async function GroupDetail({
  group,
  roster,
  alerts,
  sessions,
  outlineUnits,
  passMark,
  schoolTeachers,
  viewerId,
  planUnits,
  materials,
  planProgressPct,
  courseView,
  schoolId,
  schoolSlug,
  canManage,
}: Props) {
  const t = await getTranslations("Groups");
  const listHref = `/school/${schoolSlug}/groups`;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href={listHref}
        className="inline-flex items-center gap-1 text-sm text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) transition-colors"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        {t("detail.back")}
      </Link>

      <GroupDetailHeader
        group={group}
        alerts={alerts}
        courseView={courseView}
        schoolId={schoolId}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />

      {/* Resolve-first banner */}
      <GroupResolveBanner
        alerts={alerts}
        groupId={group.id}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />

      {/* Tab island (client) */}
      <GroupTabs
        group={group}
        roster={roster}
        sessions={sessions}
        outlineUnits={outlineUnits}
        passMark={passMark}
        schoolTeachers={schoolTeachers}
        viewerId={viewerId}
        materialsSlot={
          <GroupMaterialsTab
            group={group}
            materials={materials}
            progressPct={planProgressPct}
            planUnits={planUnits}
            schoolId={schoolId}
            schoolSlug={schoolSlug}
            canManage={canManage}
          />
        }
        alerts={alerts}
        schoolId={schoolId}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />
    </div>
  );
}
