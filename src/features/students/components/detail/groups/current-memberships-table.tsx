"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MembershipRoleBadge } from "./membership-role-badge";
import { MembershipRowKebab } from "./membership-row-kebab";
import { RemoveFromGroupDialog } from "../dialogs/remove-from-group-dialog";
import { TransferGroupDialog } from "../dialogs/transfer-group-dialog";
import type { MembershipDetail, TeacherRef } from "@/features/students/types";
import { formatDate } from "@/lib/i18n/formatters";
import type { Locale } from "@/lib/i18n/config";

type DialogState =
  | { type: "none" }
  | { type: "transfer"; membership: MembershipDetail }
  | { type: "remove"; membership: MembershipDetail };

type Props = {
  memberships: MembershipDetail[];
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolSlug: string;
  canManage: boolean;
  locale: Locale;
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

export function CurrentMembershipsTable({
  memberships,
  studentId,
  studentName,
  schoolId,
  schoolSlug,
  canManage,
  locale,
}: Props) {
  const t = useTranslations("Students");
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const formatAddedAt = (iso: string) =>
    formatDate(new Date(iso), locale, { month: "short", year: "numeric" });

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                {t("detail.groups.cols.group")}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                {t("detail.groups.cols.role")}
              </th>
              <th className="hidden md:table-cell px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                {t("detail.groups.cols.teachers")}
              </th>
              <th className="hidden lg:table-cell px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                {t("detail.groups.cols.schedule")}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                {t("detail.groups.cols.since")}
              </th>
              {canManage && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {memberships.map((m) => (
              <tr key={m.id} className="hover:bg-subtle transition-colors">
                {/* Group */}
                <td className="px-4 py-3">
                  <Link
                    href={`/school/${schoolSlug}/groups/${m.groupId}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span className="flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary leading-none text-center">
                      <span>{m.lang.toUpperCase()}</span>
                      <span>{m.level}</span>
                    </span>
                    <span className="font-medium truncate max-w-40">{m.groupName}</span>
                    {m.groupStatus === "archived" && (
                      <Badge variant="muted" className="text-[10px]">
                        archived
                      </Badge>
                    )}
                  </Link>
                </td>
                {/* Role */}
                <td className="px-4 py-3">
                  <MembershipRoleBadge
                    role={m.role}
                    label={t(`detail.groups.role.${m.role}`)}
                  />
                </td>
                {/* Teachers */}
                <td className="hidden md:table-cell px-4 py-3">
                  <TeacherStack teachers={m.teachers} />
                </td>
                {/* Schedule */}
                <td className="hidden lg:table-cell px-4 py-3 text-xs whitespace-nowrap">
                  {m.schedule[0]
                    ? `${m.schedule[0].day}${m.schedule[0].time ? ` ${m.schedule[0].time}` : ""}${m.schedule.length > 1 ? ` +${m.schedule.length - 1}` : ""}`
                    : "—"}
                </td>
                {/* Since */}
                <td className="px-4 py-3">
                  <time
                    dateTime={m.addedAt}
                    className="text-xs text-(--ssz-text-secondary) whitespace-nowrap"
                  >
                    {formatAddedAt(m.addedAt)}
                  </time>
                </td>
                {/* Actions */}
                {canManage && (
                  <td className="px-2 py-3">
                    <MembershipRowKebab
                      membershipId={m.id}
                      groupId={m.groupId}
                      groupName={m.groupName}
                      studentId={studentId}
                      studentName={studentName}
                      schoolId={schoolId}
                      schoolSlug={schoolSlug}
                      currentRole={m.role}
                      onTransfer={() => setDialog({ type: "transfer", membership: m })}
                      onRemove={() => setDialog({ type: "remove", membership: m })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog.type === "remove" && (
        <RemoveFromGroupDialog
          open
          membership={dialog.membership}
          studentName={studentName}
          schoolId={schoolId}
          onClose={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "transfer" && (
        <TransferGroupDialog
          open
          fromMembership={dialog.membership}
          studentId={studentId}
          studentName={studentName}
          schoolId={schoolId}
          schoolSlug={schoolSlug}
          onClose={() => setDialog({ type: "none" })}
        />
      )}
    </>
  );
}
