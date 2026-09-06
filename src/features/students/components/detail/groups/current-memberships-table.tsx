"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("detail.groups.cols.group")}</TableHead>
            <TableHead className="w-[130px]">{t("detail.groups.cols.role")}</TableHead>
            <TableHead className="hidden w-[140px] md:table-cell">
              {t("detail.groups.cols.teachers")}
            </TableHead>
            <TableHead className="hidden w-[160px] lg:table-cell">
              {t("detail.groups.cols.schedule")}
            </TableHead>
            <TableHead className="w-[120px]">{t("detail.groups.cols.since")}</TableHead>
            {canManage && <TableHead className="w-[80px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.map((m) => (
            <TableRow key={m.id}>
              {/* Group */}
              <TableCell>
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
              </TableCell>
              {/* Role */}
              <TableCell>
                <MembershipRoleBadge
                  role={m.role}
                  label={t(`detail.groups.role.${m.role}`)}
                />
              </TableCell>
              {/* Teachers */}
              <TableCell className="hidden md:table-cell">
                <TeacherStack teachers={m.teachers} />
              </TableCell>
              {/* Schedule */}
              <TableCell className="hidden lg:table-cell text-xs whitespace-nowrap">
                {m.schedule[0]
                  ? `${m.schedule[0].day}${m.schedule[0].time ? ` ${m.schedule[0].time}` : ""}${m.schedule.length > 1 ? ` +${m.schedule.length - 1}` : ""}`
                  : "—"}
              </TableCell>
              {/* Since */}
              <TableCell>
                <time
                  dateTime={m.addedAt}
                  className="text-xs text-(--ssz-text-secondary) whitespace-nowrap"
                >
                  {formatAddedAt(m.addedAt)}
                </time>
              </TableCell>
              {/* Actions */}
              {canManage && (
                <TableCell>
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
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
