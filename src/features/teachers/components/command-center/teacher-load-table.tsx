"use client";

import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { Trash2 } from "lucide-react";

import { HealthDot } from "@/components/shared/operations/health-dot";
import { LanguageChip } from "@/components/shared/operations/language-chip";
import { LoadBar } from "@/components/shared/operations/load-bar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { TeacherLoadRow } from "../../types";

type TeacherLoadTableProps = {
  teachers: TeacherLoadRow[];
  onRemove?: (teacherId: string, name: string) => void;
};

export function TeacherLoadTable({ teachers, onRemove }: TeacherLoadTableProps) {
  const t = useTranslations("Teachers.commandCenter.table");
  const tRoster = useTranslations("Teachers.roster.removeGuard");
  const router = useRouter();
  const params = useParams<{ locale: string; schoolSlug: string }>();

  function handleRowClick(teacherId: string) {
    router.push(`/${params.locale}/school/${params.schoolSlug}/teachers/${teacherId}`);
  }

  if (!teachers.length) return null;

  return (
    <Table role="grid" aria-label={t("name")}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead role="columnheader" scope="col">
            {t("name")}
          </TableHead>
          <TableHead role="columnheader" scope="col" className="w-40">
            {t("load")}
          </TableHead>
          <TableHead role="columnheader" scope="col" className="hidden md:table-cell">
            {t("langs")}
          </TableHead>
          <TableHead
            role="columnheader"
            scope="col"
            className="hidden w-20 text-center sm:table-cell"
          >
            {t("groups")}
          </TableHead>
          <TableHead
            role="columnheader"
            scope="col"
            className="hidden w-20 text-center sm:table-cell"
          >
            {t("conflicts")}
          </TableHead>
          {onRemove && (
            <TableHead role="columnheader" scope="col" className="w-[80px]">
              <span className="sr-only">{tRoster("confirm")}</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {teachers.map((teacher) => (
          <TableRow
            key={teacher.teacherId}
            role="row"
            onClick={() => handleRowClick(teacher.teacherId)}
            onKeyDown={(e) => e.key === "Enter" && handleRowClick(teacher.teacherId)}
            tabIndex={0}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <TableCell role="gridcell">
              <div className="flex items-center gap-2.5">
                <HealthDot state={teacher.healthState} />
                <div>
                  <div className="font-medium text-(--ssz-text-primary)">{teacher.name}</div>
                  <div className="text-xs text-(--ssz-text-muted)">
                    {teacher.contactHours.toFixed(1)}/{teacher.maxWeeklyContactHours}h
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell role="gridcell">
              <LoadBar
                contact={teacher.contactHours}
                cap={teacher.maxWeeklyContactHours}
                prep={teacher.prepHours}
              />
              <div className="mt-1 text-xs text-(--ssz-text-muted) text-right">
                {teacher.utilizationPct}%
              </div>
            </TableCell>
            <TableCell role="gridcell" className="hidden md:table-cell">
              <div className="flex flex-wrap gap-1">
                {teacher.languages.map((lang) => (
                  <LanguageChip key={lang} lang={lang} />
                ))}
              </div>
            </TableCell>
            <TableCell
              role="gridcell"
              className="hidden sm:table-cell text-center text-(--ssz-text-secondary)"
            >
              {teacher.groupCount}
            </TableCell>
            <TableCell role="gridcell" className="hidden sm:table-cell text-center">
              {teacher.conflictCount > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400">
                  {teacher.conflictCount}
                </span>
              ) : (
                <span className="text-(--ssz-text-muted)">—</span>
              )}
            </TableCell>
            {onRemove && (
              <TableCell
                role="gridcell"
                className="text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-(--ssz-text-muted) hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/30"
                  aria-label={tRoster("confirm")}
                  onClick={() => onRemove(teacher.teacherId, teacher.name)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
