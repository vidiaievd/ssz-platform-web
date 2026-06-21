import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MembershipRoleBadge } from "../groups/membership-role-badge";
import { CurrentMembershipsTable } from "../groups/current-memberships-table";
import type { StudentInSchool, TeacherRef } from "@/features/students/types";
import { formatDate } from "@/lib/i18n/formatters";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  student: StudentInSchool;
  schoolSlug: string;
  schoolId: string;
  assignHref: string;
  canManage: boolean;
};

function TeacherStack({ teachers }: { teachers: TeacherRef[] }) {
  if (teachers.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-700">
        No teacher
      </span>
    );
  }
  return (
    <div className="flex -space-x-1.5" aria-label={`${teachers.length} teachers`}>
      {teachers.slice(0, 3).map((t) => (
        <Avatar
          key={t.userId}
          src={t.avatarUrl ?? undefined}
          name={t.name}
          size="sm"
          className="ring-2 ring-background"
          title={t.name}
        />
      ))}
      {teachers.length > 3 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs ring-2 ring-background">
          +{teachers.length - 3}
        </span>
      )}
    </div>
  );
}

export async function GroupsTab({ student, schoolSlug, schoolId, assignHref, canManage }: Props) {
  const t = await getTranslations("Students");
  const locale = (await getLocale()) as Locale;

  const active = student.memberships.filter((m) => m.status === "active");
  const past = student.memberships.filter((m) => m.status === "past");

  const formatAddedAt = (iso: string) =>
    formatDate(new Date(iso), locale, { month: "short", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* ── Current memberships ──────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--ssz-text-primary)">
            {t("detail.groups.currentHeading", { n: active.length })}
          </h2>
          {canManage && (
            <Button size="sm" asChild>
              <Link href={assignHref}>{t("detail.actions.assignGroup")}</Link>
            </Button>
          )}
        </div>

        {active.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 flex flex-col items-center gap-3 text-center">
            <p className="font-semibold">{t("detail.groups.empty.title")}</p>
            <p className="text-sm text-(--ssz-text-secondary)">{t("detail.groups.empty.body")}</p>
            {canManage && (
              <Button size="sm" asChild>
                <Link href={assignHref}>{t("detail.actions.assignGroup")}</Link>
              </Button>
            )}
          </div>
        ) : (
          <CurrentMembershipsTable
            memberships={active}
            studentId={student.id}
            studentName={student.name}
            schoolId={schoolId}
            schoolSlug={schoolSlug}
            canManage={canManage}
            locale={locale}
          />
        )}
      </div>

      {/* ── Past memberships ─────────────────────────────────── */}
      <details
        open={active.length === 0}
        className="group rounded-xl border bg-card overflow-hidden"
      >
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-subtle transition-colors list-none">
          <span className="text-(--ssz-text-secondary) transition-transform group-open:rotate-90">
            ▶
          </span>
          {t("detail.groups.pastHeading", { n: past.length })}
        </summary>

        {past.length === 0 ? (
          <p className="px-4 py-3 text-sm text-(--ssz-text-secondary)">
            {t("detail.groups.pastEmpty")}
          </p>
        ) : (
          <table className="w-full text-sm border-t">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.groups.cols.group")}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.groups.cols.role")}
                </th>
                <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.groups.cols.teachers")}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  Period
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {past.map((m) => (
                <tr key={m.id} className="text-(--ssz-text-secondary)">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-(--ssz-text-primary) truncate max-w-40">
                        {m.groupName}
                      </span>
                      {m.groupStatus === "archived" && (
                        <Badge variant="muted" className="text-[10px]">
                          archived
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <MembershipRoleBadge
                      role={m.role}
                      label={t(`detail.groups.role.${m.role}`)}
                    />
                  </td>
                  <td className="hidden md:table-cell px-4 py-3">
                    <TeacherStack teachers={m.teachers} />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {formatAddedAt(m.addedAt)}
                    {" – "}
                    {m.exitedAt ? formatAddedAt(m.exitedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </div>
  );
}
