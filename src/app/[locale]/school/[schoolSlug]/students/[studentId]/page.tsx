import Link from "next/link";
import { ArrowLeft, StickyNote, CreditCard, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { getMySchoolRole } from "@/features/school/api/get-my-school-role";
import { getStudentInSchool } from "@/features/students/api/queries";
import { Avatar } from "@/components/ui/avatar";
import { StatusChip } from "@/features/students/components/status-chip";
import { StudentTabs, type TabKey } from "@/features/students/components/detail/student-tabs";
import { StudentActionMenu } from "@/features/students/components/detail/student-action-menu";
import { StudentClashBanner } from "@/features/students/components/detail/student-clash-banner";
import { OverviewTab } from "@/features/students/components/detail/tabs/overview-tab";
import { GroupsTab } from "@/features/students/components/detail/tabs/groups-tab";
import { HistoryTab } from "@/features/students/components/detail/tabs/history-tab";
import { StubTab } from "@/features/students/components/detail/tabs/stub-tab";

type Props = {
  params: Promise<{ schoolSlug: string; studentId: string; locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const VALID_TABS: TabKey[] = ["overview", "groups", "history", "notes", "payments", "bonuses"];

function resolveTab(raw: string | undefined): TabKey {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as TabKey;
  return "overview";
}

export default async function StudentDetailPage({ params, searchParams }: Props) {
  const { schoolSlug, studentId } = await params;
  const { tab: rawTab } = await searchParams;
  const activeTab = resolveTab(rawTab);

  const t = await getTranslations("Students");

  const [school, role] = await Promise.all([
    getSchoolBySlug(schoolSlug),
    getMySchoolRole(schoolSlug),
  ]);
  const student = school ? await getStudentInSchool(school.id, studentId) : null;

  if (!school || !student) notFound();

  const active = student.memberships.filter((m) => m.status === "active");
  const assignHref = `/school/${schoolSlug}/students/${studentId}/assign-group`;
  const isOwner = role === 'OWNER';

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-5">
      {/* Back link */}
      <Link
        href={`/school/${schoolSlug}/students`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("detail.backToStudents")}
      </Link>

      {/* Clash banner */}
      <StudentClashBanner clashes={student.clashes} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar
            src={student.avatarUrl ?? undefined}
            name={student.name}
            size="xl"
            className="shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold leading-none truncate">{student.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{student.email}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusChip status={student.status} />
              <span className="text-xs text-muted-foreground">
                {student.primaryLanguage.toUpperCase()} · {student.currentLevel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StudentActionMenu
            studentId={student.id}
            studentName={student.name}
            schoolId={school.id}
            schoolSlug={schoolSlug}
            activeGroupCount={active.length}
            isArchived={false}
            isOwner={isOwner}
          />
        </div>
      </div>

      {/* Tab bar */}
      <StudentTabs activeTab={activeTab} activeGroupCount={active.length} />

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          student={student}
          schoolSlug={schoolSlug}
          schoolId={school.id}
          canEdit={isOwner}
          groupsHref={`/school/${schoolSlug}/students/${studentId}?tab=groups`}
        />
      )}
      {activeTab === "groups" && (
        <GroupsTab
          student={student}
          schoolSlug={schoolSlug}
          schoolId={school.id}
          assignHref={assignHref}
          canManage={isOwner}
        />
      )}
      {activeTab === "history" && (
        <HistoryTab student={student} schoolSlug={schoolSlug} />
      )}
      {activeTab === "notes" && (
        <StubTab
          icon={StickyNote}
          title={t("detail.stubs.notes.title")}
          body={t("detail.stubs.notes.body")}
        />
      )}
      {activeTab === "payments" && (
        <StubTab
          icon={CreditCard}
          title={t("detail.stubs.payments.title")}
          body={t("detail.stubs.payments.body")}
        />
      )}
      {activeTab === "bonuses" && (
        <StubTab
          icon={Star}
          title={t("detail.stubs.bonuses.title")}
          body={t("detail.stubs.bonuses.body")}
        />
      )}
    </main>
  );
}
