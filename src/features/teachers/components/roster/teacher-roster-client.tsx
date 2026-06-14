"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { LanguageChip } from "@/components/shared/operations/language-chip";
import { PendingInvitesBadge } from "@/features/invitations/components/pending-invites-badge";
import { removeTeacher } from "../../api/mutations";
import { AddTeacherModal } from "../command-center/add-teacher-modal";
import type { TeacherRosterRow, RosterStatus } from "../../types";

type Props = {
  schoolId: string;
  schoolSlug: string;
  teachers: TeacherRosterRow[];
};

function StatusBadge({ status }: { status: RosterStatus }) {
  const t = useTranslations("Teachers.roster");
  const map: Record<RosterStatus, string> = {
    active: "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    suspended: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}

export function TeacherRosterClient({ schoolId, schoolSlug, teachers }: Props) {
  const t = useTranslations("Teachers.roster");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [, startRemove] = useTransition();

  function handleRemove(userId: string, name: string) {
    const confirmed = window.confirm(t("removeGuard.title") + "\n" + name);
    if (!confirmed) return;

    startRemove(async () => {
      const result = await removeTeacher(schoolId, userId);
      if (result.ok) {
        toast.success(name, {
          description: t("removeGuard.confirm"),
          action: { label: t("removeGuard.undo"), onClick: () => {} },
        });
        router.refresh();
      } else {
        toast.error(t("removeGuard.title"), {
          description: t("removeGuard.body", { count: result.groupCount }),
        });
      }
    });
  }

  return (
    <main className="p-4 sm:p-6 space-y-5">
      {/* Pending invitations badge (non-blocking — loads after first paint) */}
      <PendingInvitesBadge schoolId={schoolId} schoolSlug={schoolSlug} role="TEACHER" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">{t("title")}</h1>
        <Button size="sm" onClick={() => setAddOpen(true)} aria-label={t("addTeacher")}>
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          {t("addTeacher")}
        </Button>
      </div>

      {teachers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          role="status"
          aria-live="polite"
        >
          <p className="text-(--ssz-text-muted)">{t("empty")}</p>
          <Button onClick={() => setAddOpen(true)} variant="outline">
            {t("emptyCta")}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm" role="table" aria-label={t("tableLabel")}>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-(--ssz-text-secondary)">
                  {t("columns.name")}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-(--ssz-text-secondary) hidden sm:table-cell">
                  {t("columns.email")}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-(--ssz-text-secondary) hidden md:table-cell">
                  {t("columns.languages")}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-(--ssz-text-secondary)">
                  {t("columns.status")}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-(--ssz-text-secondary)">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {teachers.map((teacher) => (
                <tr key={teacher.userId} className="hover:bg-muted/30 transition-colors">
                  {/* Name + avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={teacher.name || teacher.email}
                        src={teacher.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <span className="font-medium text-(--ssz-text-primary) truncate">
                        {teacher.name || teacher.email}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 text-(--ssz-text-secondary) hidden sm:table-cell">
                    <span className="truncate max-w-50 block">{teacher.email}</span>
                  </td>

                  {/* Languages */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {teacher.languages.length > 0 ? (
                        teacher.languages.map((lang) => (
                          <LanguageChip key={lang} lang={lang} />
                        ))
                      ) : (
                        <span className="text-(--ssz-text-muted) text-xs">{t("noLanguages")}</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={teacher.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t("actions.menuLabel", { name: teacher.name || teacher.email })}
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => handleRemove(teacher.userId, teacher.name || teacher.email)}
                        >
                          <UserMinus className="mr-2 size-4" aria-hidden="true" />
                          {t("actions.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTeacherModal
        schoolId={schoolId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </main>
  );
}
