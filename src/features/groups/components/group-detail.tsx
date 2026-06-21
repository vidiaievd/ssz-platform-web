import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { GroupDetailHeader } from "./group-detail-header";
import { GroupResolveBanner } from "./group-resolve-banner";
import { GroupTabs } from "./group-tabs";
import type { Group, RosterStudent, Lesson, CourseView } from "../types";
import type { Alert } from "@/features/dashboard/types";

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  group: Group;
  roster: RosterStudent[];
  alerts: Alert[];
  lessons: Lesson[];
  courseView: CourseView;
  schoolSlug: string;
  canManage: boolean;
};

export function GroupDetail({
  group,
  roster,
  alerts,
  lessons,
  courseView,
  schoolSlug,
  canManage,
}: Props) {
  const listHref = `/school/${schoolSlug}/groups`;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href={listHref}
        className="inline-flex items-center gap-1 text-sm text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) transition-colors"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Groups
      </Link>

      <GroupDetailHeader
        group={group}
        alerts={alerts}
        courseView={courseView}
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
        lessons={lessons}
        alerts={alerts}
        courseView={courseView}
        schoolSlug={schoolSlug}
        canManage={canManage}
      />
    </div>
  );
}
