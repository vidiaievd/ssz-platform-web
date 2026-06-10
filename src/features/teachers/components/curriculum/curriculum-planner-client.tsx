"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { GroupHealthRowVM } from "@/features/groups/types";
import type { CurriculumPlan } from "../../types";
import { CurriculumUnitList } from "./curriculum-unit-list";
import { CurriculumOverrideAction } from "./curriculum-override-action";
import { TargetHoursField } from "./target-hours-field";

type CurriculumPlannerClientProps = {
  schoolId: string;
  groups: GroupHealthRowVM[];
  selectedGroupId: string | null;
  plan: CurriculumPlan | null;
};

export function CurriculumPlannerClient({
  schoolId,
  groups,
  selectedGroupId,
  plan,
}: CurriculumPlannerClientProps) {
  const t = useTranslations("Teachers.curriculum");
  const router = useRouter();

  function handleGroupChange(groupId: string) {
    router.push(`?group=${groupId}`);
  }

  return (
    <main className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="group-select" className="text-sm text-(--ssz-text-secondary) whitespace-nowrap">
            {t("selectGroup")}:
          </Label>
          <Select
            value={selectedGroupId ?? ""}
            onValueChange={handleGroupChange}
          >
            <SelectTrigger id="group-select" className="w-52">
              <SelectValue placeholder={t("selectGroup")} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!plan ? (
        <p className="text-sm text-(--ssz-text-muted)">{t("selectGroup")}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: units + target hours + override */}
          <div className="space-y-5">
            <TargetHoursField
              schoolId={schoolId}
              plan={plan}
              onUpdated={() => router.refresh()}
            />
            <CurriculumUnitList
              schoolId={schoolId}
              plan={plan}
              onUpdated={() => router.refresh()}
            />
            <CurriculumOverrideAction
              schoolId={schoolId}
              plan={plan}
              onOverridden={() => router.refresh()}
            />
          </div>

          {/* Right: placeholder for UnitLessonMapper */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-(--ssz-text-primary) mb-2">
              {t("lessonMapper")}
            </h3>
            <p className="text-xs text-(--ssz-text-muted)">
              Lesson mapping available once scheduling-service is connected.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
