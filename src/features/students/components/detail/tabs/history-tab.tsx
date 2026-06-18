import Link from "next/link";
import { TrendingUp, BookOpen, GraduationCap } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MembershipRoleBadge } from "../groups/membership-role-badge";
import type { StudentInSchool } from "@/features/students/types";
import { formatDate } from "@/lib/i18n/formatters";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  student: StudentInSchool;
  schoolSlug: string;
};

function EmptyCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof TrendingUp;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
      <p className="font-semibold text-(--ssz-text-primary)">{title}</p>
      {body && <p className="text-sm text-(--ssz-text-secondary)">{body}</p>}
    </div>
  );
}

export async function HistoryTab({ student, schoolSlug }: Props) {
  const t = await getTranslations("Students");
  const locale = (await getLocale()) as Locale;

  const fmt = (iso: string) => formatDate(new Date(iso), locale, { month: "short", year: "numeric" });

  const allMemberships = student.memberships;

  // Distinct teachers across all memberships
  const teacherMap = new Map<
    string,
    {
      userId: string;
      name: string;
      avatarUrl?: string | null;
      groups: string[];
      from: string;
      to?: string;
    }
  >();
  for (const m of allMemberships) {
    for (const teacher of m.teachers) {
      const existing = teacherMap.get(teacher.userId);
      if (!existing) {
        teacherMap.set(teacher.userId, {
          userId: teacher.userId,
          name: teacher.name,
          avatarUrl: teacher.avatarUrl,
          groups: [m.groupName],
          from: m.addedAt,
          to: m.exitedAt,
        });
      } else {
        existing.groups.push(m.groupName);
        if (m.addedAt < existing.from) existing.from = m.addedAt;
        if (!m.exitedAt) {
          existing.to = undefined;
        } else if (existing.to && m.exitedAt > existing.to) {
          existing.to = m.exitedAt;
        }
      }
    }
  }
  const distinctTeachers = [...teacherMap.values()];

  return (
    <div className="space-y-4">
      {/* ── Level progression ─────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-(--ssz-text-primary)">
          {t("detail.history.levels.heading")}
        </h2>

        {student.levelHistory.length === 0 ? (
          <EmptyCard
            icon={TrendingUp}
            title={t("detail.history.levels.empty.title")}
            body={t("detail.history.levels.empty.body")}
          />
        ) : (
          <ol className="flex flex-col gap-0 sm:flex-row sm:gap-0 sm:overflow-x-auto">
            {student.levelHistory.map((entry, i) => (
              <li key={i} className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 min-w-30">
                {/* Connector line */}
                {i > 0 && (
                  <div className="sm:hidden w-px h-4 bg-border ml-5" aria-hidden />
                )}
                <div className="flex sm:flex-col items-center gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Badge variant="level" className="text-xs">
                      {entry.level}
                    </Badge>
                  </div>
                  {i < student.levelHistory.length - 1 && (
                    <div className="hidden sm:block w-full h-px bg-border flex-1" aria-hidden />
                  )}
                </div>
                <div className="pb-4 sm:pb-0 sm:text-center">
                  <p className="text-xs text-(--ssz-text-secondary)">
                    {fmt(entry.startedAt)}
                    {" – "}
                    {entry.endedAt ? fmt(entry.endedAt) : t("detail.history.levels.present")}
                  </p>
                  {entry.groupName && (
                    <p className="text-xs mt-0.5">
                      {entry.groupId ? (
                        <Link
                          href={`/school/${schoolSlug}/groups/${entry.groupId}`}
                          className="hover:underline text-(--ssz-text-link)"
                        >
                          {entry.groupName}
                        </Link>
                      ) : (
                        entry.groupName
                      )}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Study periods ──────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-(--ssz-text-primary)">
          {t("detail.history.periods.heading")}
        </h2>

        {allMemberships.length === 0 ? (
          <EmptyCard
            icon={BookOpen}
            title={t("detail.history.periods.empty.title")}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.history.periods.cols.period")}
                </th>
                <th className="pb-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.history.periods.cols.group")}
                </th>
                <th className="hidden sm:table-cell pb-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.history.periods.cols.role")}
                </th>
                <th className="hidden md:table-cell pb-2.5 text-left text-xs font-medium text-(--ssz-text-secondary)">
                  {t("detail.history.periods.cols.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allMemberships.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 text-xs text-(--ssz-text-secondary) whitespace-nowrap pr-3">
                    {fmt(m.addedAt)}
                    {" – "}
                    {m.exitedAt ? fmt(m.exitedAt) : t("detail.history.levels.present")}
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/school/${schoolSlug}/groups/${m.groupId}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <span className="flex h-6 w-6 shrink-0 flex-col items-center justify-center rounded bg-primary/10 text-[8px] font-bold text-primary leading-none">
                        <span>{m.lang.toUpperCase()}</span>
                        <span>{m.level}</span>
                      </span>
                      <span className="truncate max-w-32">{m.groupName}</span>
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell py-3">
                    <MembershipRoleBadge role={m.role} />
                  </td>
                  <td className="hidden md:table-cell py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "active"
                          ? "bg-success-100 text-success-700"
                          : "bg-muted text-(--ssz-text-secondary)"
                      }`}
                    >
                      {m.status === "active"
                        ? t("detail.history.periods.statusActive")
                        : t("detail.history.periods.statusCompleted")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Teacher history ─────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-(--ssz-text-primary)">
          {t("detail.history.teachers.heading")}
        </h2>

        {distinctTeachers.length === 0 ? (
          <EmptyCard
            icon={GraduationCap}
            title={t("detail.history.teachers.empty.title")}
          />
        ) : (
          <ul className="space-y-3">
            {distinctTeachers.map((teacher) => (
              <li key={teacher.userId} className="flex items-center gap-3">
                <Avatar
                  src={teacher.avatarUrl ?? undefined}
                  name={teacher.name}
                  size="md"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{teacher.name}</p>
                  <p className="text-xs text-(--ssz-text-secondary)">
                    {fmt(teacher.from)}
                    {" – "}
                    {teacher.to ? fmt(teacher.to) : t("detail.history.levels.present")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
