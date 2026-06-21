import Link from "next/link";
import { TrendingUp, Clock, GraduationCap, Copy } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

import { formatDate, formatRelative } from "@/lib/i18n/formatters";
import type { Locale } from "@/lib/i18n/config";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { StatusChip } from "@/features/students/components/status-chip";
import type { StudentInSchool, MembershipDetail } from "@/features/students/types";

type Props = {
  student: StudentInSchool;
  schoolSlug: string;
  schoolId: string;
  canEdit: boolean;
  groupsHref: string;
};

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      data-copy={value}
      className="ml-1 inline-flex items-center rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Copy ${value}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

export async function OverviewTab({ student, schoolSlug, canEdit, groupsHref }: Props) {
  const t = await getTranslations("Students");
  const locale = (await getLocale()) as Locale;

  const activeMemberships = student.memberships.filter((m) => m.status === "active");
  const allTeachers = activeMemberships.flatMap((m) => m.teachers);
  const distinctTeachers = [...new Map(allTeachers.map((t) => [t.userId, t])).values()];

  const addedDate = formatDate(new Date(student.addedToSchoolAt), locale);
  const lastSeenText = student.lastActiveAt
    ? formatRelative(new Date(student.lastActiveAt), locale)
    : t("detail.lastSeen.never");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Left: Student information ─────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--ssz-text-primary)">
            {t("detail.info.heading")}
          </h2>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("detail.actions.editInfo")}
            >
              <span className="text-base leading-none">✎</span>
            </Button>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          {/* Email */}
          <div className="group flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-(--ssz-text-secondary)">
              {t("detail.info.email")}
            </dt>
            <dd className="flex min-w-0 items-center truncate">
              <a
                href={`mailto:${student.email}`}
                className="truncate text-(--ssz-text-primary) hover:underline"
              >
                {student.email}
              </a>
              <CopyButton value={student.email} />
            </dd>
          </div>

          {/* Phone */}
          {student.phone && (
            <div className="group flex items-baseline gap-2">
              <dt className="w-28 shrink-0 text-(--ssz-text-secondary)">
                {t("detail.info.phone")}
              </dt>
              <dd className="flex min-w-0 items-center">
                <span>{student.phone}</span>
                <CopyButton value={student.phone} />
              </dd>
            </div>
          )}

          {/* Status */}
          <div className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-(--ssz-text-secondary)">
              {t("detail.info.status")}
            </dt>
            <dd>
              <StatusChip status={student.status} />
            </dd>
          </div>

          {/* Language */}
          <div className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-(--ssz-text-secondary)">
              {t("detail.info.language")}
            </dt>
            <dd className="text-(--ssz-text-primary)">{student.primaryLanguage.toUpperCase()}</dd>
          </div>

          {/* Level */}
          <div className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-(--ssz-text-secondary)">
              {t("detail.info.level")}
            </dt>
            <dd>
              <Badge variant="level">{student.currentLevel}</Badge>
            </dd>
          </div>

          {/* Date added */}
          <div className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-(--ssz-text-secondary)">
              {t("detail.info.addedAt")}
            </dt>
            <dd>
              <time dateTime={student.addedToSchoolAt} className="text-(--ssz-text-primary)">
                {addedDate}
              </time>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Right: Active groups + Quick stats ─────────────── */}
      <div className="space-y-4">
        <ActiveGroupsCard
          memberships={activeMemberships}
          schoolSlug={schoolSlug}
          groupsHref={groupsHref}
          t={t}
        />

        {/* Quick stats card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          {/* Progress */}
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex-1 min-w-0 space-y-1.5">
              <span className="text-xs text-(--ssz-text-secondary)">
                {t("detail.stats.progress")}
              </span>
              <ProgressBar
                value={student.progress}
                showLabel
                aria-label={`${student.progress}% complete`}
              />
            </div>
          </div>

          {/* Last seen */}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-(--ssz-text-secondary)">{t("detail.stats.lastSeen")}</p>
              <p className="text-sm font-medium">{lastSeenText}</p>
            </div>
          </div>

          {/* Teachers */}
          <div className="flex items-center gap-3">
            <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-(--ssz-text-secondary)">
                {t("detail.stats.teachers", { n: distinctTeachers.length })}
              </p>
              {distinctTeachers.length === 0 ? (
                <p className="text-sm text-(--ssz-color-error-700) dark:text-(--ssz-color-error-300)">
                  {t("detail.stats.noTeacher")}
                </p>
              ) : (
                <div
                  className="flex -space-x-1.5"
                  aria-label={`${distinctTeachers.length} teachers`}
                >
                  {distinctTeachers.slice(0, 3).map((teacher) => (
                    <Avatar
                      key={teacher.userId}
                      src={teacher.avatarUrl ?? undefined}
                      name={teacher.name}
                      size="sm"
                      className="ring-2 ring-background"
                      title={teacher.name}
                    />
                  ))}
                  {distinctTeachers.length > 3 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                      +{distinctTeachers.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function ActiveGroupsCard({
  memberships,
  schoolSlug,
  groupsHref,
  t,
}: {
  memberships: MembershipDetail[];
  schoolSlug: string;
  groupsHref: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  if (memberships.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm font-semibold">{t("detail.groups.empty.title")}</p>
        <Button size="sm" asChild>
          <Link href={groupsHref}>{t("detail.actions.assignGroup")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-(--ssz-text-primary)">
        {t("detail.groups.activeHeading", { n: memberships.length })}
      </h2>

      <ul className="space-y-1">
        {memberships.map((m) => (
          <li key={m.id}>
            <Link
              href={`/school/${schoolSlug}/groups/${m.groupId}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle transition-colors"
            >
              <span className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary leading-none text-center">
                <span>{m.lang.toUpperCase()}</span>
                <span>{m.level}</span>
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-(--ssz-text-primary)">
                {m.groupName}
              </span>
              {m.schedule[0] && (
                <span className="text-xs text-(--ssz-text-secondary) shrink-0">
                  {m.schedule[0].day}
                  {m.schedule[0].time ? ` ${m.schedule[0].time}` : ""}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href={groupsHref}
        className="block text-xs text-(--ssz-text-link) hover:underline pt-1"
      >
        {t("detail.groups.viewAll")}
      </Link>
    </div>
  );
}
