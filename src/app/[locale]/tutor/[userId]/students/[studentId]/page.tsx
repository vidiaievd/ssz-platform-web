import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';
import { getStudentInSchool } from '@/features/students/api/queries';
import { Avatar } from '@/components/ui/avatar';
import { StudentTabs, type TabKey } from '@/features/students/components/detail/student-tabs';
import { OverviewTab } from '@/features/students/components/detail/tabs/overview-tab';
import { HistoryTab } from '@/features/students/components/detail/tabs/history-tab';
import { StudentNudgeButton } from '@/features/students/components/student-nudge-button';

type Props = {
  params: Promise<{ userId: string; studentId: string; locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

// A tutor's card carries what a tutor works with. Groups, payments and bonuses
// describe a school's relationship with a learner (plan 59, §4).
const TUTOR_TABS: TabKey[] = ['overview', 'history'];

export default async function TutorStudentDetailPage({ params, searchParams }: Props) {
  const { userId, studentId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = rawTab === 'history' ? 'history' : 'overview';

  const tTutor = await getTranslations('Tutor.students');

  const workspace = await getTutorWorkspace();
  const student = workspace ? await getStudentInSchool(workspace.schoolId, studentId) : null;
  if (!workspace || !student) notFound();

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-5">
      <Link
        href={`/tutor/${userId}/students`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {tTutor('backToStudents')}
      </Link>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            src={student.avatarUrl ?? undefined}
            name={student.name}
            size="xl"
            className="shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-semibold leading-none">{student.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{student.email}</p>
            <p className="pt-1 text-xs text-muted-foreground">
              {student.primaryLanguage.toUpperCase()} · {student.currentLevel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StudentNudgeButton
            schoolId={workspace.schoolId}
            userId={student.id}
            studentName={student.name}
          />
        </div>
      </div>

      <StudentTabs
        activeTab={tab}
        activeGroupCount={0}
        showMastery={false}
        tabs={TUTOR_TABS}
      />

      {tab === 'overview' && (
        <OverviewTab
          student={student}
          // No group screens exist for a tutor, so nothing links to one.
          workspaceId=""
          schoolId={workspace.schoolId}
          canEdit={false}
          groupsHref=""
          showGroups={false}
        />
      )}
      {tab === 'history' && (
        <HistoryTab student={student} workspaceId="" linkGroups={false} />
      )}
    </main>
  );
}
