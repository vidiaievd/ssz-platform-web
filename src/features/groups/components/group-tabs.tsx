'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroupHealthLine } from './group-health-line';
import { OverviewCards } from './overview-cards';
import { GroupStudentsTab } from './group-students-tab';
import { GroupTeachersTab } from './group-teachers-tab';
import { GroupScheduleTab } from './group-schedule-tab';
import type { Group, RosterStudent, Lesson, CourseView } from '../types';
import type { Alert } from '@/features/dashboard/types';

type TabKey = 'overview' | 'students' | 'teachers' | 'schedule';

type Props = {
  group: Group;
  roster: RosterStudent[];
  lessons: Lesson[];
  alerts: Alert[];
  courseView: CourseView;
  schoolSlug: string;
  canManage: boolean;
};

export function GroupTabs({ group, roster, lessons, alerts, courseView, schoolSlug, canManage }: Props) {
  const t = useTranslations('Groups');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get('tab') as TabKey | null) ?? 'overview';

  function handleTabChange(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  const detailBase = `/school/${schoolSlug}/groups/${group.id}`;
  const assignTeacherHref = `${detailBase}/assign-teacher`;
  const addStudentsHref   = `${detailBase}/add-students`;

  // Resolve the schoolId from the group — we need it for remove actions.
  // schoolId is not directly on the Group type, but we can derive it from the
  // BFF queries. For now we pass it via schoolSlug and rely on the server action
  // to accept the slug-or-id. Phase 5 will thread schoolId properly from page.tsx.
  // As a workaround, the removal server actions accept schoolId — we'll pass
  // schoolSlug as the identifier (server resolves slug → id).
  const schoolId = schoolSlug; // resolved by the BFF

  const tabLabel: Record<TabKey, string> = {
    overview: t('tabs.overview'),
    students: roster.length > 0 ? `${t('tabs.students')} ${roster.length}` : t('tabs.students'),
    teachers: t('tabs.teachers'),
    schedule: t('tabs.schedule'),
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* Mobile: tabs collapse into a Select mirroring the same labels/counts (spec §8). */}
      <Select value={activeTab} onValueChange={handleTabChange}>
        <SelectTrigger className="md:hidden w-full h-11" aria-label={t('tabs.sectionLabel')}>
          <SelectValue>{tabLabel[activeTab]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="overview">{tabLabel.overview}</SelectItem>
          <SelectItem value="students">{tabLabel.students}</SelectItem>
          <SelectItem value="teachers">{tabLabel.teachers}</SelectItem>
          <SelectItem value="schedule">{tabLabel.schedule}</SelectItem>
        </SelectContent>
      </Select>

      <TabsList className="hidden md:flex overflow-x-auto">
        <TabsTrigger value="overview">{tabLabel.overview}</TabsTrigger>
        <TabsTrigger value="students">{tabLabel.students}</TabsTrigger>
        <TabsTrigger value="teachers">{tabLabel.teachers}</TabsTrigger>
        <TabsTrigger value="schedule">{tabLabel.schedule}</TabsTrigger>
      </TabsList>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview">
        <div className="space-y-4">
          <GroupHealthLine alerts={alerts} status={group.status} />
          <OverviewCards
            group={group}
            roster={roster}
            lessons={lessons}
            alerts={alerts}
            courseView={courseView}
            canManage={canManage}
            schoolSlug={schoolSlug}
          />
        </div>
      </TabsContent>

      {/* ── Students ──────────────────────────────────────────────────────── */}
      <TabsContent value="students">
        <GroupStudentsTab
          roster={roster}
          group={group}
          schoolId={schoolId}
          addStudentsHref={addStudentsHref}
        />
      </TabsContent>

      {/* ── Teachers ──────────────────────────────────────────────────────── */}
      <TabsContent value="teachers">
        <GroupTeachersTab
          teachers={group.teachers}
          schoolId={schoolId}
          groupId={group.id}
          assignTeacherHref={assignTeacherHref}
        />
      </TabsContent>

      {/* ── Schedule ──────────────────────────────────────────────────────── */}
      <TabsContent value="schedule">
        <GroupScheduleTab slots={group.slots} lessons={lessons} />
      </TabsContent>
    </Tabs>
  );
}
